import express from 'express'
import { WebSocketServer } from 'ws'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db, { getAgents, getTasks, insertTask, updateTask } from './db.js'
import { clampToRoom, resolveObstacles, WALL } from '../src/office-plan.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
// serve hasil build vite (production)
app.use(express.static(path.join(__dirname, '..', 'dist')))

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// ---- state runtime ----
// agent: { id, role, x, z, tx, tz, state: idle|walking|working, heading, task, bubble, restT }
const agents = new Map()
for (const a of getAgents()) {
  agents.set(a.id, {
    id: a.id, role: a.role, skill: a.skill,
    x: a.desk_x, z: a.desk_z, tx: a.desk_x, tz: a.desk_z,
    state: 'idle', heading: 0, task: null, bubble: null, restT: 0,
  })
}

// player peers: ws → { name, x, z }
const peers = new Map()

const SPEED = 3.5
const DESKS = Object.fromEntries(getAgents().map((a) => [a.id, { x: a.desk_x, z: a.desk_z }]))

// spot santai untuk idle behavior
const HANGOUTS = [
  { x: 0, z: 1 }, { x: -2, z: 2 }, { x: 2, z: 2 }, { x: -8, z: -1 }, { x: 8, z: -2 },
]

function broadcast(obj) {
  const s = JSON.stringify(obj)
  for (const c of wss.clients) if (c.readyState === 1) c.send(s)
}

function snapshot() {
  return {
    type: 'snapshot',
    agents: [...agents.values()].map(({ id, role, x, z, heading, state, bubble }) => ({ id, role, x: +x.toFixed(2), z: +z.toFixed(2), heading: +heading.toFixed(2), state, bubble })),
    agentsStatic: getAgents(),
    tasks: getTasks(),
    peers: [...peers.values()].map(({ name, x, z }) => ({ name, x: +x.toFixed(2), z: +z.toFixed(2) })),
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(snapshot()))
  ws.on('message', (data) => {
    let m
    try { m = JSON.parse(data) } catch { return }
    if (m.type === 'player-pos') {
      // validasi posisi: tolak NaN / tipe aneh biar ga relay sampah ke client lain
      if (!Number.isFinite(m.x) || !Number.isFinite(m.z)) return
      let name = typeof m.name === 'string' ? m.name.slice(0, 24).trim() : ''
      if (!name) name = `tamu${peers.size + 1}`
      // nama harus unik antar peer; tambahkan suffix kalau sudah dipakai orang lain
      const taken = (n) => [...peers.values()].some((p) => p.name === n)
      if (taken(name)) {
        let n = 2
        while (taken(`${name}-${n}`)) n++
        name = `${name}-${n}`
      }
      const p = peers.get(ws) ?? { name }
      p.x = +(+m.x).toFixed(2)
      p.z = +(+m.z).toFixed(2)
      peers.set(ws, p)
      // relay ke pemain lain (bukan pengirim)
      const msg = JSON.stringify({ type: 'peers', peers: [...peers.values()].map(q => ({ name: q.name, x: q.x, z: q.z })) })
      for (const [c] of peers) {
        if (c !== ws && c.readyState === 1) c.send(msg)
      }
    } else if (m.type === 'chat') {
      // chat global: siarkan ke semua (termasuk pengirim biar tampil konsisten)
      const p = peers.get(ws)
      const text = String(m.text ?? '').slice(0, 120)
      if (text.trim()) {
        broadcast({ type: 'chat', name: p?.name ?? '??', text, agent: null, at: Date.now() })
        // jawaban canned dari agent terdekat
        const nearest = [...agents.values()].sort(
          (a, b) => Math.hypot(a.x - (p?.x ?? 0), a.z - (p?.z ?? 0)) - Math.hypot(b.x - (p?.x ?? 0), b.z - (p?.z ?? 0))
        )[0]
        setTimeout(() => {
          if (nearest && nearest.state === 'idle') {
            const replies = [
              'siap! ada yang bisa dibantu?',
              'oh iya? nanti ku kerjain',
              'hmm, catat dulu ya di task',
              'yes boss 😄',
              'sabar, masih backlog nih',
            ]
            broadcast({ type: 'chat', name: nearest.id, text: replies[Math.floor(Math.random() * replies.length)], agent: nearest.id, at: Date.now() })
          }
        }, 900)
      }
    } else if (m.type === 'dm-agent') {
      // DM ke agent tertentu → canned reply dengan bubble pada agent
      const a = agents.get(String(m.agent ?? ''))
      if (a) {
        const text = String(m.text ?? '').slice(0, 120)
        const replies = {
          programmer: ['oke, kucatat di backlog', 'kuberes sekitar 502 hari ini 😅', 'coba cek board, tasknya jalan'],
          designer: ['mantap, ku masuk sprint berikut', 'warna? biru lagi dong', 'figma-nya lagi dibuka'],
          qa: ['ikatanyaku baik, task ada', 'kasih estimasi ya', 'lulus QA? ntar ku tes'],
          lead: ['prioritasnya bagus', 'tarik aman dulu', 'meeting 5 menit?'],
        }
        const reply = (replies[a.role] ?? ['noted'])[Math.floor(Math.random() * 3)]
        a.bubble = `💬 ${reply}`
        a.restT = 3
        broadcast({ type: 'chat', name: a.id, text: reply, agent: a.id, at: Date.now() })
      }
    }
  })
  ws.on('close', () => {
    peers.delete(ws)
    broadcast({ type: 'peers', peers: [...peers.values()].map(q => ({ name: q.name, x: q.x, z: q.z })) })
  })
})

// ---- dispatch: berikan task todo ke agent idle ----
function dispatch() {
  const todos = getTasks().filter((t) => t.status === 'todo')
  for (const t of todos) {
    const agent = [...agents.values()].find((a) => a.state === 'idle' && a.role !== 'lead')
    if (!agent) break
    assign(agent, t)
  }
}

// ---- review: ambil task status review ke pengurus lead (skill paling tinggi) ----
function dispatchReview() {
  const reviews = getTasks().filter((t) => t.status === 'review')
  for (const t of reviews) {
    const lead = [...agents.values()].find((a) => a.state === 'idle' && a.role === 'lead')
    if (!lead) break // lead sibuk → nunggu
    // lead berjalan ke ruang meeting untuk review
    updateTask(t.id, { status: 'in_progress', agent_id: lead.id, progress: 0, est: 3 })
    lead.task = t.id
    lead.state = 'walking'
    lead.bubble = `🔎 review: ${t.title}`
    lead.tx = 0 // ruang meeting
    lead.tz = -5.2
    broadcast({ type: 'task-update' })
  }
}

function assign(agent, task) {
  updateTask(task.id, { status: 'in_progress', agent_id: agent.id })
  agent.task = task.id
  agent.state = 'walking'
  agent.bubble = `📄 ${task.title}`
  agent.tx = DESKS[agent.id].x
  agent.tz = DESKS[agent.id].z
  broadcast({ type: 'task-update' })
}

// ---- simulasi kerja bertahap: baca → kerja → cek → selesai ----
const STARTERS = {
  programmer: (t) => `baca spek "${t}" → cari file terkait`,
  designer: (t) => `riset referensi "${t}" → buka moodboard`,
  qa: (t) => `susun rencana uji "${t}" → cek scope`,
  lead: (t) => `analisis dampak "${t}" → baca konteks git`,
}
const MOODS = {
  programmer: ['nulis modul utama', 'refactor fungsi lama', 'pcah logic ke hook', 'fix edge case'],
  designer: ['sketsa layout v2', 'atur palet warna', 'bikin komponen tombol', 'uji kontras teks'],
  qa: ['tulis kasus uji', 'uji jalur utama', 'cari edge case', 'uji regresi'],
  lead: ['review desain API', 'cek style kode', 'peta risiko', 'susun estimasi'],
}
const CLOSERS = {
  programmer: (f, n) => `✔ selesai\nfiles: ${f} file diubah (+${n * 37} -${n * 8})\ntest: ${n * 4} passed, 0 gagal`,
  designer: (f) => `✔ mockup siap\n${f} frame baru\nhandoff: siap di-review tim`,
  qa: (f, n) => `✔ uji tuntas\n${n * 6} kasus dijalankan, ${Math.max(0, n - 1)} gagal ditemukan\nkualitas: lolos`,
  lead: (f) => `✔ review disetujui ✅\nkeputusan: merge\ncatatan: ${f} poin minor (ikut sprint depat)`,
}

// pipeline per agent: daftar { label, durasi-fraksi } — total fraksi = 1
const PIPELINE = [
  { frac: 0.15 }, // baca/research
  { frac: 0.45 }, // kerja utama
  { frac: 0.25 }, // iterasi/cek
  { frac: 0.15 }, // wrap-up
]

function stageBubble(stage, role, title) {
  if (stage === 0) return STARTERS[role]?.(title) ?? `mulai "${title}"`
  if (stage === 1) return MOODS[role][Math.floor(Math.random() * MOODS[role].length)]
  if (stage === 2) return 'cek hasil...'
  return 'rapi-kan dokumentasi'
}

function finishOutput(role, title) {
  const f = 2 + Math.floor(Math.random() * 4)
  const n = 1 + Math.floor(Math.random() * 3)
  return {
    text: CLOSERS[role]?.(f, n) ?? `✔ ${title} tuntas`,
    log: `${STARTERS[role]?.(title) ?? 'mulai'}\n${MOODS[role].join('\n')}\n${CLOSERS[role]?.(f, n) ?? 'selesai'}`,
  }
}

// ---- sim loop: 20 tick/detik ----
const TICK = 50
setInterval(() => {
  const dt = TICK / 1000
  let posChanged = false

  for (const a of agents.values()) {
    // bergerak ke target dgn collision sederhana
    const dx = a.tx - a.x
    const dz = a.tz - a.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.05) {
      const step = Math.min(SPEED * dt, dist)
      const obj = { x: a.x + (dx / dist) * step, z: a.z + (dz / dist) * step }
      clampToRoom(obj)
      resolveObstacles(obj, 0.5)
      a.heading = Math.atan2(obj.x - a.x, obj.z - a.z)
      a.x = obj.x
      a.z = obj.z
      posChanged = true
      if (Math.hypot(a.tx - a.x, a.tz - a.z) <= 0.05) {
        if (a.state === 'walking') a.state = 'working'
      }
    } else if (a.state === 'walking') {
      // sudah di target (mis. spawn tepat di meja) → langsung kerja
      a.state = 'working'
    }

    // kerja: pipeline tahap baca → kerja → cek → selesai
    if (a.state === 'working' && a.task != null) {
      const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(a.task)
      if (!t) { a.task = null; a.state = 'idle'; continue }

      const frac = t.progress / t.est
      let acc = 0
      let stage = 0
      for (let i = 0; i < PIPELINE.length; i++) {
        acc += PIPELINE[i].frac
        if (frac < acc) { stage = i; break }
        stage = i
      }
      const bubble = stageBubble(stage, a.role, t.title)
      if (a.bubble !== bubble) {
        a.bubble = bubble
        posChanged = true
      }

      const inc = (a.skill ?? 1) * dt
      const prog = Math.min(t.progress + inc, t.est)
      updateTask(t.id, { progress: prog })
      if (prog >= t.est) {
        // lead selesai review → task done. worker non-lead → masuk antrian review
        const isReview = t.status === 'in_progress' && t.agent_id === 'lead'
        const out = finishOutput(a.role, t.title)
        updateTask(t.id, isReview
          ? { status: 'done', progress: t.est, finished_at: new Date().toISOString(), output: out.text }
          : { status: 'review', progress: t.est })
        a.task = null
        a.state = 'idle'
        a.bubble = isReview ? '✅ approved' : '📨 kirim review'
        a.restT = 3
        broadcast({ type: 'task-update' })
        if (isReview) {
          // lead selesai: cek antrian todo berikutnya
          setImmediate(() => dispatch())
        } else {
          // dispatch lead ke review
          setImmediate(() => dispatchReview())
        }
      }
    }

    // idle behavior: setelah selesai/punya waktu luang, jalan-jalan sesekali
    if (a.state === 'idle') {
      if (a.restT > 0) {
        a.restT -= dt
        if (a.restT <= 0) a.bubble = null
      } else {
        a.restT = 6 + Math.random() * 10
        if (Math.random() < 0.5) {
          // jalan ke spot hangout
          const h = HANGOUTS[Math.floor(Math.random() * HANGOUTS.length)]
          a.tx = h.x + (Math.random() - 0.5) * 2
          a.tz = h.z + (Math.random() - 0.5) * 2
          a.state = 'walking'
          a.idleWalk = true
        } else {
          // ngomong sendiri
          const chat = ['☕ ngopi dulu', 'push & pray', 'baca docs dulu', 'review pr temen', 'enta task lagi...']
          a.bubble = chat[Math.floor(Math.random() * chat.length)]
          a.restT = 2 + Math.random() * 2
        }
      }
    }
    // selesai idle-walk: kembali jadi idle di spot
    if (a.idleWalk && a.state === 'walking' && Math.hypot(a.tx - a.x, a.tz - a.z) <= 0.05) {
      a.idleWalk = false
      a.state = 'idle'
      a.bubble = null
      a.restT = 3 + Math.random() * 5
    }
  }

  if (posChanged) {
    broadcast({
      type: 'agents',
      agents: [...agents.values()].map((a) => ({ id: a.id, x: +a.x.toFixed(2), z: +a.z.toFixed(2), heading: +a.heading.toFixed(2), state: a.state, bubble: a.bubble })),
    })
  }
}, TICK)

// dispatch awal & berkala
dispatch()
dispatchReview()
setInterval(() => { dispatch(); dispatchReview() }, 1000)

// ---- REST API ----
app.get('/api/tasks', (_req, res) => res.json(getTasks()))
app.get('/api/agents', (_req, res) => res.json(getAgents()))
app.post('/api/tasks', (req, res) => {
  const { title, est = 5 } = req.body || {}
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title wajib' })
  const e = Number(est)
  if (!Number.isFinite(e) || e <= 0 || e > 600) return res.status(400).json({ error: 'est 1..600 detik' })
  const info = insertTask(title.trim().slice(0, 80), e)
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(info.lastInsertRowid)
  broadcast({ type: 'task-update' })
  dispatch()
  res.status(201).json(t)
})

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id)
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
  if (!t) return res.status(404).json({ error: 'tidak ada' })
  // kalau sedang dikerjakan, bebaskan agent-nya
  for (const a of agents.values()) {
    if (a.task === id) { a.task = null; a.state = 'idle'; a.bubble = null }
  }
  db.prepare('DELETE FROM tasks WHERE id=?').run(id)
  broadcast({ type: 'task-update' })
  dispatch()
  res.json({ ok: true })
})

// stats per agent: total task done, rata-rata waktu
app.get('/api/stats', (_req, res) => {
  const rows = db.prepare(`
    SELECT agent_id AS id,
           COUNT(*) AS done,
           AVG(CAST(julianday(finished_at) - julianday(created_at) AS REAL)) AS avgDays
    FROM tasks
    WHERE status='done' AND agent_id IS NOT NULL
    GROUP BY agent_id
  `).all()
  const agents = getAgents().map((a) => {
    const r = rows.find((x) => x.id === a.id)
    return {
      id: a.id, role: a.role,
      done: r?.done ?? 0,
      avgSec: r ? Math.round((r.avgDays ?? 0) * 86400 * 10) / 10 : 0,
    }
  })
  res.json(agents)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`kantor server on http://localhost:${PORT}`))
