import express from 'express'
import { WebSocketServer } from 'ws'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db, { getAgents, getTasks, getTasksByStatus, recoverStuckTasks, RESTART_NOTE, insertTask, updateTask, getTask, getRunningTaskBySession, insertClaudeTask, publicTask, logSession, getHistory, costSummary } from './db.js'
import { clampToRoom, resolveObstacles, DESK_SEATS, SPOTS, SEATS, MEET_LEAD } from '../src/office-plan.js'
import { TOILET, free, route, plan } from './route.js'
import { parseHook } from './live.js'
import crypto from 'node:crypto'
import { checkControl } from './control.js'
import { loadProjects, addProject, removeProject, setProjectChecks } from './projects.js'
import { loadKitAgents, writeAgentsFile, orchestrationPrompt } from './kit.js'
import { prepare as prepareWork, snapshot as saveWork, diffOf, mergeBranch, discard } from './gitwork.js'
import { createSessions, MAX_PROMPT } from './sessions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// ---- hook Claude Code → kantor ----
// Hanya dari mesin ini. Didaftarkan sebelum express.json bawaan karena payload tool bisa besar
// (isi file); payload rusak atau kelewat besar dijawab 200 supaya hook tidak mencatat kegagalan.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
app.post(
  '/api/events',
  (req, res, next) => (LOOPBACK.has(req.socket.remoteAddress) ? next() : res.status(403).json({ error: 'hanya dari mesin ini' })),
  express.json({ limit: '25mb' }),
  (req, res) => { if (!sessions.ownsClaudeId(req.body?.session_id)) applyHook(parseHook(req.body)); res.json({ ok: true }) },
  (_err, _req, res, _next) => res.json({ ok: false }),
)

app.use(express.json())
// serve hasil build vite (production)
app.use(express.static(path.join(__dirname, '..', 'dist')))

const server = http.createServer(app)
const wss = new WebSocketServer({ server, maxPayload: 4096 })

// ---- tempat di kantor ----
// Tempat pakai (SPOTS, SEATS, MEET_LEAD, DESK_SEATS) ada di src/office-plan.js, dibagi dengan klien; rute ke sana
// ada di server/route.js.
// agent hanya bersuara untuk kerja dan aktivitas ini: satu bubble saat berangkat, lalu diam
const ACT_BUBBLE = {
  toilet: 'ke toilet', sofa: 'istirahat', game: 'main game', arcade: 'main arcade', pingpong: 'main pingpong',
  coffee: 'ngopi', eat: 'makan', board: 'cek papan task', print: 'ngeprint', read: 'baca buku',
}
const ACT_STAY = {
  toilet: [5, 8], sofa: [8, 14], game: [10, 16], arcade: [7, 12], pingpong: [9, 14], coffee: [4, 6],
  eat: [9, 14], board: [5, 9], print: [4, 6], read: [6, 10],
}
// bobot memilih aktivitas saat senggang (sisanya jalan-jalan)
const ACT_WEIGHT = [['sofa', 12], ['game', 12], ['arcade', 9], ['pingpong', 10], ['coffee', 10], ['eat', 12], ['board', 8], ['print', 5], ['read', 7]]

// Kursi kerja agent (DESK_SEATS) ada di src/office-plan.js; posisi meja di tabel agents (desk_x, desk_z) tidak dipakai lagi.
function deskSpot(a) {
  const s = DESK_SEATS[a.id]
  return s ? { key: `desk-${a.id}`, ...s, pose: 'sit' } : { key: `desk-${a.id}`, x: a.desk_x, z: a.desk_z }
}

// ---- state runtime ----
// agent: { id, role, x, z, tx, tz, state: idle|walking|working, heading, task, bubble, restT, pose, spot, go, fatigue }
// Agent tambahan supaya meja kerja terpakai. Kolom desk_x dan desk_z tidak dipakai (kursi ada di DESK_SEATS).
for (const [id, role, skill] of [['prog3', 'programmer', 1.1], ['prog4', 'programmer', 0.9], ['prog5', 'programmer', 1.0], ['designer2', 'designer', 0.9], ['designer3', 'designer', 1.0], ['qa2', 'qa', 1.0]]) {
  db.prepare('INSERT OR IGNORE INTO agents (id, role, desk_x, desk_z, skill) VALUES (?,?,0,0,?)').run(id, role, skill)
}
const agents = new Map()
for (const a of getAgents()) {
  const desk = deskSpot(a)
  agents.set(a.id, {
    id: a.id, role: a.role, skill: a.skill,
    x: desk.x, z: desk.z, tx: desk.x, tz: desk.z,
    state: 'idle', heading: desk.h ?? 0, task: null, bubble: null, restT: 0,
    pose: null, spot: null, go: null, desk,
    fatigue: 0, fatigueMax: 20 + Math.random() * 40,
  })
}

// Mengirim agent ke suatu tempat. Tempat dengan key dipesan (a.spot) supaya dua agent tidak merebut kursi
// yang sama; act = aktivitas senggang (kunci ACT_STAY), dipakai saat sampai.
function goTo(a, spot, act = null) {
  a.tx = spot.ax ?? spot.x
  a.tz = spot.az ?? spot.z
  a.go = { spot, act }
  a.spot = spot.key ?? null
  a.pose = null
  // keluar atau masuk toilet: lewat pintu dulu; kursi meja: lewat titik di lorong
  // keluar dari tempat duduk lewat titik masuknya dulu (sofa terhalang sandaran, kursi meja lewat lorong)
  const seq = [...(a.at?.via ? [a.at.via] : []), ...(TOILET.inside(a) !== TOILET.inside({ x: a.tx, z: a.tz }) ? [TOILET.door] : []), ...(spot.via ? [spot.via] : [])]
  a.at = null
  a.vias = plan(a, seq)
  dirty = true
}

// Sampai: duduk atau berdiri tepat di titik tempatnya dan menghadap arah yang ditentukan
function settle(a) {
  const g = a.go
  if (!g) return
  // target ikut dipindah ke titik duduk, kalau tidak agent akan jalan lagi ke titik pendekatannya
  a.x = a.tx = g.spot.x
  a.z = a.tz = g.spot.z
  if (g.spot.h !== undefined) a.heading = g.spot.h
  a.pose = g.spot.pose ?? null
  a.at = g.spot
  a.go = null
  if (g.act) {
    const [lo, hi] = ACT_STAY[g.act]
    a.restT = lo + Math.random() * (hi - lo)
    if (g.act === 'toilet') { a.fatigue = 0; a.fatigueMax = 20 + Math.random() * 40 }
  }
  dirty = true
}

const freeSpot = (list) => {
  const used = new Set([...agents.values()].map((a) => a.spot))
  return list.find((s) => !used.has(s.key)) ?? null
}

// player peers: ws → { name, want, x, z }  (want = nama yang diminta klien)
const peers = new Map()

// riwayat chat di memori, dikirim ke pendatang baru lewat snapshot
const chatLog = []

const SPEED = 3.5
// jarak "sudah sampai". Titik meja agent menempel di tepi kotak tabrakan meja, jadi resolveObstacles
// mendorong agent sekitar 0,25 keluar dan titik persisnya tidak pernah tercapai.
const ARRIVE = 0.35
// teks bubble saat lead menyetujui task; klien (AgentAvatars.jsx) memakainya sebagai pemicu konfeti
const APPROVED = 'Disetujui'
// spot santai untuk idle behavior; semuanya di ruang bebas (lorong tengah, koridor antar meja, dekat TV, area depan)
const HANGOUTS = [
  { x: 0, z: 2.5 }, { x: 0, z: 7.7 }, { x: -9, z: 1.5 }, { x: 9, z: 0.5 }, { x: -9, z: 5.5 }, { x: 1.5, z: 10.5 },
]

// ---- agen nyata dari hook Claude Code (server/live.js, .claude/settings.json) ----
// Tiap subagent yang berjalan muncul sebagai karakter tamu: masuk lewat pintu depan, duduk di
// kursi ruang meeting, bubble-nya mengikuti tool yang sedang dipakai, lalu berkonfeti dan pulang.
// Mereka memakai gerak dan loop yang sama dengan agent simulasi, tapi tidak punya task di database.
const LIVE_MAX = 12
const LINGER_MS = Number(process.env.LIVE_LINGER_MS ?? 4000)
const LIVE_STALE_MS = 15 * 60 * 1000 // SubagentStop yang tak pernah datang (sesi mati): pulangkan sendiri
const DOOR = { x: 0, z: 10.4 }
const DONE = 'Selesai' // klien (AgentAvatars.jsx) memakainya sebagai pemicu konfeti
// jam simulasi: naik tepat 50 ms tiap tick, apa pun kondisi timer. Klien memakainya (bukan waktu tiba paket)
// untuk menginterpolasi gerak agent, jadi jitter jaringan dan timer tidak terlihat sebagai gerak patah.
let simT = 0
let dirty = false // ada perubahan di luar gerak (agen datang, pergi, ganti bubble) yang perlu disiarkan
const pendingAsk = new Map() // tipe subagent → deskripsi dari sesi utama, dipakai SubagentStart berikutnya
const liveAgents = () => [...agents.values()].filter((a) => a.live)

const pubAgent = (a) => ({
  id: a.id, role: a.role, x: +a.x.toFixed(2), z: +a.z.toFixed(2), heading: +a.heading.toFixed(2), state: a.state, bubble: a.bubble, pose: a.pose,
  ...(a.live && { live: true, look: a.look, label: a.label }),
})

function liveStart(rawId, type) {
  const id = `live-${rawId}`
  if (agents.has(id) || liveAgents().length >= LIVE_MAX) return
  const queue = pendingAsk.get(type) ?? []
  while (queue.length && Date.now() - queue[0].at > 120000) queue.shift()
  const ask = queue.shift()
  const same = liveAgents().filter((a) => a.look === type).length
  const a = {
    id, role: 'live', live: true, skill: 1, look: type, label: same ? `${type} ${same + 1}` : type,
    x: DOOR.x, z: DOOR.z, tx: DOOR.x, tz: DOOR.z, state: 'walking', heading: Math.PI,
    task: null, bubble: ask?.text || 'Mulai bekerja', restT: 0, pose: null, spot: null, go: null, lastEvent: Date.now(),
  }
  agents.set(id, a)
  goTo(a, freeSpot(SEATS) ?? { x: (Math.random() - 0.5) * 6, z: -3.5 + Math.random() * 2.5 })
}

function liveTool(rawId, type, text) {
  const a = agents.get(`live-${rawId}`)
  if (!a) {
    // hook dipasang di tengah proses: SubagentStart terlewat, jadi agen dibuat dari event tool pertama
    if (type) { liveStart(rawId, type); const n = agents.get(`live-${rawId}`); if (n) n.bubble = text }
    return
  }
  if (a.done) return
  a.bubble = text
  a.lastEvent = Date.now()
  dirty = true
}

function liveStop(id, text = DONE) {
  const a = agents.get(id)
  if (!a || a.done) return
  a.done = true
  a.state = 'idle'
  a.tx = a.x
  a.tz = a.z
  a.vias = []
  a.bubble = text
  a.leaveAt = Date.now() + LINGER_MS
  dirty = true
}

function applyHook(act) {
  if (!act) return
  if (act.kind === 'start') liveStart(act.id, act.type)
  else if (act.kind === 'stop') liveStop(`live-${act.id}`)
  else if (act.kind === 'tool') liveTool(act.id, act.type, act.text)
  else if (act.kind === 'ask') {
    const q = pendingAsk.get(act.type) ?? []
    q.push({ text: act.text, at: Date.now() })
    pendingAsk.set(act.type, q.slice(-20))
  }
}

function broadcast(obj) {
  const s = JSON.stringify(obj)
  for (const c of wss.clients) if (c.readyState === 1) c.send(s)
}

function sayChat(m) {
  const msg = { type: 'chat', ...m, at: Date.now() }
  chatLog.push(msg)
  if (chatLog.length > 30) chatLog.shift()
  broadcast(msg)
}

// daftar pemain lain untuk satu penerima: dirinya sendiri tidak ikut, jadi klien tidak perlu menyaring
const peerList = (except) =>
  [...peers].filter(([c]) => c !== except).map(([, q]) => ({ name: q.name, x: q.x, z: q.z, ts: q.ts, ct: q.ct, pose: q.pose, h: q.h }))

function broadcastPeers(skip = null) {
  for (const c of wss.clients) {
    if (c !== skip && c.readyState === 1) c.send(JSON.stringify({ type: 'peers', peers: peerList(c) }))
  }
}

// nama harus unik antar peer; tambahkan suffix kalau sudah dipakai orang lain
function uniqueName(base, self) {
  const taken = (n) => [...peers].some(([c, q]) => c !== self && q.name === n)
  if (!taken(base)) return base
  let n = 2
  while (taken(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function snapshot(ws) {
  return {
    type: 'snapshot',
    ts: simT,
    agents: [...agents.values()].map(pubAgent),
    agentsStatic: getAgents(),
    tasks: getTasks(),
    peers: peerList(ws),
    chat: chatLog,
  }
}

wss.on('connection', (ws) => {
  // tanpa listener ini, satu frame rusak atau terlalu besar dari klien mana pun mematikan seluruh server;
  // ws menutup soketnya sendiri, handler 'close' di bawah yang membersihkan peer
  ws.on('error', () => {})
  ws.send(JSON.stringify(snapshot(ws)))
  ws.on('message', (data) => {
    let m
    try { m = JSON.parse(data) } catch { return }
    if (m.type === 'player-pos') {
      // validasi posisi: tolak NaN / tipe aneh biar ga relay sampah ke client lain
      if (!Number.isFinite(m.x) || !Number.isFinite(m.z)) return
      const want = typeof m.name === 'string' ? m.name.slice(0, 24).trim() : ''
      let p = peers.get(ws)
      if (!p) { p = {}; peers.set(ws, p) }
      // nama dihitung ulang hanya saat permintaan berubah, jadi pemain bisa ganti nama tanpa suffix naik terus
      if (p.want !== want) {
        p.want = want
        p.name = uniqueName(want || `tamu${peers.size}`, ws)
      }
      p.x = +(+m.x).toFixed(2)
      p.z = +(+m.z).toFixed(2)
      p.ts = Date.now() // cap waktu terima: cadangan bila klien pengirim tidak mengirim ct
      // ct: jam browser pengirim saat posisi diambil. Dibuang bila bukan angka biasa, agar tidak merusak garis waktu penerima.
      p.ct = Number.isFinite(m.ct) && m.ct >= 0 && m.ct < 1e12 ? m.ct : undefined
      // pose (duduk, main) dan arah hadap hanya diterima dari daftar yang dikenal, supaya klien lain tidak menerima sampah
      p.pose = ['sit', 'game', 'play'].includes(m.pose) ? m.pose : undefined
      p.h = p.pose && Number.isFinite(m.h) && Math.abs(m.h) < 10 ? +(+m.h).toFixed(2) : undefined
      broadcastPeers(ws)
    } else if (m.type === 'chat' || m.type === 'dm-agent') {
      // batasi spam: satu pesan per 500 ms per koneksi
      const now = Date.now()
      if (now - (ws.lastChatAt ?? 0) < 500) return
      ws.lastChatAt = now
    }
    if (m.type === 'chat') {
      // chat global: siarkan ke semua (termasuk pengirim biar tampil konsisten)
      const p = peers.get(ws)
      const text = String(m.text ?? '').slice(0, 120)
      if (text.trim()) {
        sayChat({ name: p?.name ?? '??', text, agent: null })
        // agent tidak membalas chat global; hanya DM langsung ke agent yang dijawab (di bawah)
      }
    } else if (m.type === 'dm-agent') {
      // DM ke agent tertentu → canned reply dengan bubble pada agent
      const a = agents.get(String(m.agent ?? ''))
      if (a) {
        const text = String(m.text ?? '').slice(0, 120)
        const replies = {
          programmer: ['oke, kucatat di backlog', 'kuberes sekitar 502 hari ini', 'coba cek board, tasknya jalan'],
          designer: ['mantap, ku masuk sprint berikut', 'warna? biru lagi dong', 'figma-nya lagi dibuka'],
          qa: ['ikatanyaku baik, task ada', 'kasih estimasi ya', 'lulus QA? ntar ku tes'],
          lead: ['prioritasnya bagus', 'tarik aman dulu', 'meeting 5 menit?'],
        }
        const reply = (replies[a.role] ?? ['noted'])[Math.floor(Math.random() * 3)]
        a.bubble = reply
        a.restT = Math.max(a.restT, 3)
        dirty = true
        sayChat({ name: a.id, text: reply, agent: a.id })
      }
    }
  })
  ws.on('close', () => {
    peers.delete(ws)
    broadcastPeers()
  })
})

// ---- dispatch: berikan task todo ke agent idle ----
function dispatch() {
  for (const t of getTasksByStatus('todo')) {
    if (t.mode !== 'sim') continue // task Claude dikerjakan sesi Claude Code, bukan agent simulasi
    const agent = [...agents.values()].find((a) => a.state === 'idle' && a.role !== 'lead' && !a.live)
    if (!agent) break
    assign(agent, t)
  }
}

// ---- review: ambil task status review ke pengurus lead (skill paling tinggi) ----
function dispatchReview() {
  for (const t of getTasksByStatus('review')) {
    if (t.mode !== 'sim') continue // task Claude menunggu keputusan pemilik komputer, bukan review lead simulasi
    const lead = [...agents.values()].find((a) => a.state === 'idle' && a.role === 'lead')
    if (!lead) break // lead sibuk → nunggu
    // lead berjalan ke kursinya di ruang meeting untuk review
    updateTask(t.id, { status: 'in_progress', agent_id: lead.id, progress: 0, est: 3 })
    lead.task = t.id
    lead.state = 'walking'
    lead.idleWalk = false
    lead.bubble = `Review: ${t.title}`
    goTo(lead, MEET_LEAD)
    broadcast({ type: 'task-update' })
  }
}

function assign(agent, task) {
  updateTask(task.id, { status: 'in_progress', agent_id: agent.id })
  agent.task = task.id
  agent.state = 'walking'
  agent.idleWalk = false
  agent.bubble = `Mengerjakan: ${task.title}`
  goTo(agent, agent.desk)
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
  programmer: (f, n) => `Selesai\nfiles: ${f} file diubah (+${n * 37} -${n * 8})\ntest: ${n * 4} passed, 0 gagal`,
  designer: (f) => `Mockup siap\n${f} frame baru\nhandoff: siap di-review tim`,
  qa: (f, n) => `Uji tuntas\n${n * 6} kasus dijalankan, ${Math.max(0, n - 1)} gagal ditemukan\nkualitas: lolos`,
  lead: (f) => `Review disetujui\nkeputusan: merge\ncatatan: ${f} poin minor (ikut sprint depat)`,
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
    text: CLOSERS[role]?.(f, n) ?? `${title} tuntas`,
    log: `${STARTERS[role]?.(title) ?? 'mulai'}\n${MOODS[role].join('\n')}\n${CLOSERS[role]?.(f, n) ?? 'selesai'}`,
  }
}

// ---- sim loop: 20 tick/detik ----
const TICK = 50
setInterval(() => {
  const dt = TICK / 1000
  simT += TICK
  let posChanged = dirty
  dirty = false

  for (const a of agents.values()) {
    // tamu agen nyata: pulang setelah selesai, atau bila kabar terakhirnya sudah terlalu lama
    if (a.live) {
      const now = Date.now()
      if (!a.done && now - a.lastEvent > LIVE_STALE_MS) liveStop(a.id)
      if (a.done && !a.leaving && now > a.leaveAt) {
        a.leaving = true
        goTo(a, DOOR)
        a.state = 'walking'
        a.idleWalk = true // supaya tiba di pintu tidak diubah jadi "working"
        a.bubble = null
        posChanged = true
      }
      if (a.leaving && Math.hypot(DOOR.x - a.x, DOOR.z - a.z) <= ARRIVE + 0.3) {
        agents.delete(a.id)
        posChanged = true
        continue
      }
    }

    // Macet: agent berjalan lurus ke target dan bisa tertahan tegak lurus di tepi kotak meja atau dinding. Tiap
    // 1,5 detik, bila nyaris tidak bergerak, ia memilih titik koridor (WAYPOINTS) yang terlihat; bila tetap gagal
    // setelah 30 detik berjalan, langsung dipindah ke target.
    // shortcut: titik koridor tetap, bukan pencarian rute sungguhan; ganti dengan A* bila denah berubah banyak
    if (a.state === 'walking') {
      a.walkT = (a.walkT ?? 0) + dt
      a.sampT = (a.sampT ?? 0) + dt
      if (a.sampT >= 1.5) {
        if (a.sx !== undefined && Math.hypot(a.x - a.sx, a.z - a.sz) < 0.15 && Math.hypot(a.tx - a.x, a.tz - a.z) > ARRIVE) {
          // tertahan di tepi kelompok meja atau dinding: pilih titik koridor yang terlihat dari sini. Tanpa titik
          // yang terlihat, titik singgah dilepas dan agent mencoba lurus lagi (menyusur tepi bisa membebaskannya)
          a.vias = route(a, { x: a.tx, z: a.tz })
        }
        a.sx = a.x
        a.sz = a.z
        a.sampT = 0
      }
      if (a.walkT > 30) { a.x = a.tx; a.z = a.tz; a.vias = []; a.walkT = 0; posChanged = true }
    } else {
      a.walkT = 0
      a.sampT = 0
      a.sx = undefined
      a.vias = []
    }

    // bergerak ke target (atau titik singgah pertama) dgn collision sederhana
    const via = a.vias?.[0]
    const dx = (via ? via.x : a.tx) - a.x
    const dz = (via ? via.z : a.tz) - a.z
    const dist = Math.hypot(dx, dz)
    if (via && dist <= ARRIVE) {
      a.vias.shift()
      // titik singgah terakhir dicapai tetapi tujuan masih terhalang: sisipkan titik koridor berikutnya
      if (!a.vias.length) a.vias = route(a, { x: a.tx, z: a.tz })
    }
    if (dist > ARRIVE) {
      const step = Math.min(SPEED * dt, dist)
      const obj = { x: a.x + (dx / dist) * step, z: a.z + (dz / dist) * step }
      clampToRoom(obj)
      resolveObstacles(obj, 0.5)
      a.heading = Math.atan2(obj.x - a.x, obj.z - a.z)
      a.x = obj.x
      a.z = obj.z
      posChanged = true
      // jalan santai yang selesai ditangani blok idle di bawah; kalau diubah jadi working di sini,
      // agent tanpa task tidak pernah kembali idle dan tidak pernah dipilih dispatcher
      if (Math.hypot(a.tx - a.x, a.tz - a.z) <= ARRIVE && a.state === 'walking' && !a.idleWalk) { a.state = 'working'; settle(a) }
    } else if (a.state === 'walking' && !a.idleWalk && Math.hypot(a.tx - a.x, a.tz - a.z) <= ARRIVE) {
      // sudah di target (mis. spawn tepat di meja) → langsung kerja
      a.state = 'working'
      settle(a)
    }

    // kerja: pipeline tahap baca → kerja → cek → selesai
    if (a.state === 'working' && !a.live) a.fatigue += dt
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
        a.bubble = isReview ? APPROVED : 'Kirim ke review'
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

    // idle behavior: capek sehabis kerja → ke toilet; selain itu istirahat di sofa, main game, ngopi, makan, atau
    // jalan-jalan. Agent tidak ngomong sendiri: bubble hanya untuk kerja dan aktivitas ini (satu bubble saat berangkat).
    if (a.state === 'idle' && !a.live) {
      if (a.restT > 0) {
        a.restT -= dt
        if (a.restT <= 0) { a.bubble = null; dirty = true }
      } else {
        a.restT = 6 + Math.random() * 10
        const r = Math.random()
        let pick = r * 100
        let act = a.fatigue > a.fatigueMax ? 'toilet' : null
        if (!act) for (const [name, w] of ACT_WEIGHT) { if ((pick -= w) < 0) { act = name; break } }
        const spot = act && freeSpot(SPOTS[act])
        if (spot) {
          goTo(a, spot, act)
          a.state = 'walking'
          a.idleWalk = true
          a.bubble = ACT_BUBBLE[act]
        } else if (r < 0.95) {
          // jalan ke spot hangout
          const h = HANGOUTS[Math.floor(Math.random() * HANGOUTS.length)]
          goTo(a, { x: h.x + (Math.random() - 0.5) * 2, z: h.z + (Math.random() - 0.5) * 2 })
          a.state = 'walking'
          a.idleWalk = true
        }
      }
    }
    // selesai idle-walk: kembali jadi idle di spot
    if (a.idleWalk && a.state === 'walking' && Math.hypot(a.tx - a.x, a.tz - a.z) <= ARRIVE) {
      a.idleWalk = false
      a.state = 'idle'
      a.bubble = null
      a.restT = 3 + Math.random() * 5
      settle(a)
    }
  }

  if (posChanged) broadcast({ type: 'agents', ts: simT, agents: [...agents.values()].map(pubAgent) })
}, TICK)

// dispatch awal & berkala
const recovered = recoverStuckTasks()
if (recovered.todo || recovered.review) console.log(`task nyangkut dipulihkan: ${recovered.todo} ke todo, ${recovered.review} ke review`)
for (const t of getTasksByStatus('review')) {
  // pekerjaan yang terputus saat server mati disimpan sebagai commit supaya tidak hilang
  if (t.mode === 'claude' && t.worktree && t.output === RESTART_NOTE) saveWork({ worktree: t.worktree, title: t.title, taskId: t.id }).catch(() => {})
}
dispatch()
dispatchReview()
setInterval(() => { dispatch(); dispatchReview(); dispatchClaude() }, 1000)

// ---- REST API ----
app.get('/api/tasks', (req, res) => res.json(isOwner(req) ? getTasks() : getTasks().map(publicTask)))
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

app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id)
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
  if (!t) return res.status(404).json({ error: 'tidak ada' })
  if (t.mode === 'claude') {
    if (!isOwner(req)) return res.status(403).json({ error: 'hanya dari komputer ini' })
    if (t.status === 'in_progress' && t.session_id) await stopAndWait(t.session_id)
    const d = await dropWork(t)
    if (d.error) return res.status(400).json(d)
  }
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


// ---- sesi Claude Code yang dijalankan dari dashboard ----
// Menjalankan `claude -p` di folder proyek terdaftar (server/projects.json). Hanya dari komputer ini, dengan
// token acak tiap server start; pemain lain di jaringan hanya melihat karakternya. Lihat server/control.js.
const KANTOR_TOKEN = crypto.randomBytes(16).toString('hex')
const PROJECTS_FILE = process.env.KANTOR_PROJECTS ?? path.join(__dirname, 'projects.json')
// array yang sama dipegang mesin sesi, jadi daftar diganti di tempat (splice), bukan dengan array baru
const projects = loadProjects(PROJECTS_FILE)
const projectList = () => projects.map(({ id, name, path: dir, checks }) => ({ id, name, path: dir, checks }))
const liveKey = (s) => `sess-${s.id}-${s.runs}`
const sessions = createSessions({
  projects,
  bin: process.env.KANTOR_CLAUDE_BIN ?? 'claude',
  hooks: {
    onStart: (s) => { liveStart(liveKey(s), s.projectName) },
    onTool: (s, text) => liveTool(liveKey(s), s.projectName, text),
    onStop: (s) => {
      liveStop(`live-${liveKey(s)}`, { done: DONE, stopped: 'Dihentikan', error: 'Gagal' }[s.state])
      logSessionEnd(s)
      finishClaudeTask(s).catch(() => {})
    },
    // subagent yang dipanggil sesi tampil sebagai karakter tamu sendiri, dibaca dari stream sesi (tanpa hook terpasang)
    onSubagent: (s, ev) => {
      const id = `${liveKey(s)}-${ev.id}`
      if (ev.kind === 'start') liveStart(id, ev.type)
      else if (ev.kind === 'tool') liveTool(id, ev.type, ev.text)
      else liveStop(`live-${id}`)
    },
    onChange: () => broadcast({ type: 'sessions' }), // sinyal saja: isi sesi diambil lewat REST yang berpenjaga
  },
})
process.on('exit', () => sessions.stopAll())

const control = (needToken) => (req, res, next) => {
  const why = checkControl(
    { remoteAddress: req.socket.remoteAddress, host: req.headers.host, origin: req.headers.origin, token: req.headers['x-kantor-token'] },
    KANTOR_TOKEN,
    { needToken },
  )
  return why ? res.status(403).json({ error: why }) : next()
}
const isOwner = (req) => checkControl(
  { remoteAddress: req.socket.remoteAddress, host: req.headers.host, origin: req.headers.origin, token: '' },
  KANTOR_TOKEN,
  { needToken: false },
) === null
// dashboard meminta token dan daftar proyek di sini; pemain dari jaringan mendapat 403 dan panel sesi tersembunyi
app.get('/api/control', control(false), (_req, res) => res.json({ token: KANTOR_TOKEN, projects: projects.map(({ id, name }) => ({ id, name })) }))
// Daftar proyek bisa diubah dari dashboard dengan penjaga yang sama dengan sesi (komputer ini, Host dan Origin lokal, token).
// Alamat folder datang dari klien, jadi addProject memeriksa bahwa itu folder lengkap yang ada; izin tool tetap bawaan.
app.get('/api/projects', control(true), (_req, res) => res.json(projectList()))
app.post('/api/projects', control(true), (req, res) => {
  const r = addProject(PROJECTS_FILE, { name: req.body?.name, path: req.body?.path, checks: req.body?.checks === true })
  if (r.error) return res.status(400).json(r)
  projects.splice(0, projects.length, ...loadProjects(PROJECTS_FILE))
  return res.status(201).json(projectList())
})
app.patch('/api/projects/:id', control(true), (req, res) => {
  const r = setProjectChecks(PROJECTS_FILE, req.params.id, req.body?.checks === true)
  if (r.error) return res.status(400).json(r)
  projects.splice(0, projects.length, ...loadProjects(PROJECTS_FILE))
  return res.json(projectList())
})
app.delete('/api/projects/:id', control(true), (req, res) => {
  if (sessions.list().some((s) => s.projectId === req.params.id && (s.state === 'running' || s.state === 'stopping'))) {
    return res.status(400).json({ error: 'ada sesi yang masih berjalan di proyek ini, hentikan dulu' })
  }
  const r = removeProject(PROJECTS_FILE, req.params.id)
  if (r.error) return res.status(400).json(r)
  projects.splice(0, projects.length, ...loadProjects(PROJECTS_FILE))
  return res.json(projectList())
})
// ---- task yang dikerjakan Claude Code ----
// Dibuat dan diputuskan hanya lewat penjaga yang sama dengan sesi. Sesi berjalan dengan subagent kit
// (.claude/agents), batas biaya per task, dan hasilnya hanya tampil di komputer ini (lihat publicTask).
const KIT_DIR = path.join(__dirname, '..', '.claude', 'agents')
const BUDGET = Number(process.env.KANTOR_MAX_BUDGET)
const MAX_BUDGET = Number.isFinite(BUDGET) && BUDGET > 0 ? BUDGET : 2

// roles: nama subagent yang dipilih untuk task ini (null: semua subagent kit)
function claudeRun(roles = null) {
  const all = loadKitAgents(KIT_DIR)
  const kit = roles ? Object.fromEntries(Object.entries(all).filter(([name]) => roles.includes(name))) : all
  if (!Object.keys(kit).length) return { budget: MAX_BUDGET }
  return { budget: MAX_BUDGET, agentsFile: writeAgentsFile(kit), appendPrompt: orchestrationPrompt(kit) }
}

// keepSession: sesi yang selesai normal tetap tersimpan di task, karena Revisi melanjutkannya (--resume)
const toReview = (t, note, detail = null, keepSession = false) => {
  updateTask(t.id, { status: 'review', session_id: keepSession ? t.session_id : null, output: note, detail })
  broadcast({ type: 'task-update' })
}

// Folder kerja per task (git worktree). Di dalam server/, yang sudah di-gitignore lewat pola workspace/.
const WORK_ROOT = path.join(__dirname, 'workspace')
const projectOf = (t) => projects.find((p) => p.id === t.project_id)
const noBranch = { branch: null, worktree: null, base: null }
// sisa folder kosong dari pembuangan sebelumnya (di Windows folder yang baru dihapus bisa tertahan sebentar);
// rmdir hanya menghapus folder kosong, jadi folder kerja yang masih berisi tidak mungkin ikut terhapus
try {
  for (const name of fs.readdirSync(WORK_ROOT)) {
    try { fs.rmdirSync(path.join(WORK_ROOT, name)) } catch { /* masih berisi atau dipakai: biarkan */ }
  }
} catch { /* belum ada folder kerja */ }

// Membuang cabang kerja sebuah task. Proyek yang sudah tidak terdaftar tidak bisa dibersihkan dari sini.
async function dropWork(t) {
  if (!t.worktree && !t.branch) return { ok: true }
  const project = projectOf(t)
  if (!project) return { ok: true }
  return discard({ projectDir: project.path, worktree: t.worktree, branch: t.branch })
}

// Menunggu sesi benar-benar berhenti sebelum folder kerjanya dibuang.
async function stopAndWait(sessionId) {
  sessions.stop(sessionId)
  for (let i = 0; i < 50; i++) {
    const s = sessions.get(sessionId)
    if (!s || (s.state !== 'running' && s.state !== 'stopping')) return
    await new Promise((r) => setTimeout(r, 100))
  }
}

// task Claude di antrian jalan satu per satu sampai batas sesi; sisanya menunggu. Proyek git bekerja di
// cabang sendiri (kantor/task-N), proyek biasa langsung di foldernya. Pemanggilan tumpang tindih diabaikan.
let dispatching = false
async function dispatchClaude() {
  if (dispatching) return
  dispatching = true
  try {
    for (const t of getTasksByStatus('todo')) {
      if (t.mode !== 'claude') continue
      const project = projectOf(t)
      if (!project) { toReview(t, 'Proyek sudah tidak ada di daftar.'); continue }
      if (!sessions.hasSlot()) break // penuh: jangan menyiapkan cabang untuk task yang belum bisa jalan
      const run = claudeRun(parseRoles(t.roles))
      const work = await prepareWork({ projectDir: project.path, taskId: t.id, projectId: project.id, root: WORK_ROOT })
      if (work.error) { toReview(t, 'Gagal menyiapkan cabang kerja.', work.error); continue }
      if (work.cwd) {
        run.cwd = work.cwd
        updateTask(t.id, { branch: work.branch, worktree: work.worktree, base: work.base })
      }
      const r = sessions.start({ projectId: project.id, prompt: t.prompt || t.title, run })
      if (r.error) {
        if (work.cwd) { await discard({ projectDir: project.path, worktree: work.worktree, branch: work.branch }); updateTask(t.id, noBranch) }
        if (r.busy) break
        toReview(t, 'Gagal dimulai.', r.error)
        continue
      }
      updateTask(t.id, { status: 'in_progress', session_id: r.id, output: null, detail: null })
      broadcast({ type: 'task-update' })
    }
  } finally {
    dispatching = false
  }
}

const parseRoles = (v) => { try { const r = JSON.parse(v); return Array.isArray(r) ? r : null } catch { return null } }

// setiap akhir sesi dicatat (task maupun manual): dasar biaya dan riwayat
function logSessionEnd(s) {
  const t = getRunningTaskBySession(s.id)
  try {
    logSession({
      task_id: t?.id ?? null, project: s.projectName, state: s.state, runs: s.runs, tools: s.tools,
      denials: s.result?.denials ?? 0, cost: s.result?.cost ?? 0, seconds: s.result?.seconds ?? null,
      subagents: JSON.stringify([...s.subagents.values()].map((x) => x.type)),
      result: s.result?.text || s.lastText || null, error: s.error ?? null,
      started_at: new Date(s.startedAt).toISOString(), ended_at: new Date().toISOString(),
    })
  } catch { /* riwayat gagal tertulis tidak boleh menjatuhkan sesi */ }
}

// sesi selesai, gagal, atau dihentikan: hasil kerjanya disimpan sebagai commit di cabang task (termasuk yang
// belum tuntas), lalu task menunggu keputusan di kolom Review
async function finishClaudeTask(s) {
  const t = getRunningTaskBySession(s.id)
  if (!t) return
  let note = { done: 'Selesai, menunggu persetujuan', stopped: 'Dihentikan', error: 'Gagal, perlu dicek' }[s.state] ?? 'Selesai'
  if (s.result?.denials) note += `, ${s.result.denials} izin ditolak`
  let detail = s.state === 'error' ? (s.error ?? null) : (s.result?.text || s.lastText || null)
  if (t.worktree) {
    const snap = await saveWork({ worktree: t.worktree, title: t.title, taskId: t.id })
    if (snap.error) { note += ', perubahan gagal disimpan'; detail = `${snap.error}\n\n${detail ?? ''}`.trim() }
  }
  toReview(t, note, detail, true)
}

const claudeTask = (req, res, need) => {
  const t = getTask(Number(req.params.id))
  if (!t || t.mode !== 'claude') { res.status(404).json({ error: 'task Claude tidak ada' }); return null }
  if (t.status !== need) { res.status(400).json({ error: `task harus di kolom ${need}` }); return null }
  return t
}

app.post('/api/tasks/claude', control(true), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 80) : ''
  const given = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  const prompt = given || title
  if (!title) return res.status(400).json({ error: 'judul wajib' })
  if (!projects.some((p) => p.id === req.body?.projectId)) return res.status(400).json({ error: 'proyek tidak dikenal' })
  if (prompt.length > MAX_PROMPT) return res.status(400).json({ error: `instruksi terlalu panjang (maksimal ${MAX_PROMPT} huruf)` })
  if (prompt.startsWith('-')) return res.status(400).json({ error: 'instruksi tidak boleh diawali tanda minus' })
  // roles: pilihan subagent; kosong atau semua dipilih berarti semua subagent kit
  let roles = null
  if (req.body?.roles !== undefined && req.body?.roles !== null) {
    const kit = Object.keys(loadKitAgents(KIT_DIR))
    const given = Array.isArray(req.body.roles) ? [...new Set(req.body.roles)] : null
    if (!given || given.some((n) => !kit.includes(n))) return res.status(400).json({ error: 'peran tidak dikenal' })
    if (given.length === 0) return res.status(400).json({ error: 'pilih minimal satu peran' })
    if (given.length < kit.length) roles = given
  }
  const info = insertClaudeTask(title, req.body.projectId, prompt, roles)
  broadcast({ type: 'task-update' })
  dispatchClaude()
  res.status(201).json(getTask(info.lastInsertRowid))
})
app.post('/api/tasks/:id/approve', control(true), (req, res) => {
  const t = claudeTask(req, res, 'review')
  if (!t) return
  // disetujui tanpa digabung: cabang kerja tetap ada supaya bisa digabung sendiri nanti
  updateTask(t.id, { status: 'done', finished_at: new Date().toISOString(), ...(t.branch && { output: `Disetujui. Perubahan ada di cabang ${t.branch}, belum digabung.` }) })
  broadcast({ type: 'task-update' })
  res.json({ ok: true })
})
app.post('/api/tasks/:id/retry', control(true), async (req, res) => {
  const t = claudeTask(req, res, 'review')
  if (!t) return
  const d = await dropWork(t)
  if (d.error) return res.status(400).json(d)
  updateTask(t.id, { status: 'todo', session_id: null, output: null, detail: null, ...noBranch })
  broadcast({ type: 'task-update' })
  dispatchClaude()
  res.json({ ok: true })
})
// Gabungkan: cabang task masuk ke cabang aktif proyek, lalu cabang dan folder kerjanya dibuang
const merging = new Set()
app.post('/api/tasks/:id/merge', control(true), async (req, res) => {
  const t = claudeTask(req, res, 'review')
  if (!t) return
  if (!t.branch) return res.status(400).json({ error: 'task ini tidak memakai cabang kerja' })
  const project = projectOf(t)
  if (!project) return res.status(400).json({ error: 'proyek sudah tidak ada di daftar' })
  if (merging.has(t.id)) return res.status(400).json({ error: 'penggabungan sedang berjalan' })
  merging.add(t.id)
  try {
    const m = await mergeBranch({ projectDir: project.path, branch: t.branch, title: t.title })
    if (m.error) return res.status(400).json(m)
    const d = await discard({ projectDir: project.path, worktree: t.worktree, branch: t.branch })
    updateTask(t.id, {
      status: 'done', finished_at: new Date().toISOString(), session_id: null,
      output: d.error ? `Digabung ke cabang ${m.into}, tetapi folder kerja belum terhapus: ${d.error}` : `Digabung ke cabang ${m.into}.`,
      ...(d.error ? {} : noBranch),
    })
    broadcast({ type: 'task-update' })
    res.json({ ok: true, into: m.into })
  } finally {
    merging.delete(t.id)
  }
})
// Perubahan yang dibuat sebuah task: daftar berkas dan patch terhadap titik awalnya
app.get('/api/tasks/:id/diff', control(true), async (req, res) => {
  const t = getTask(Number(req.params.id))
  if (!t || t.mode !== 'claude' || !t.worktree) return res.status(404).json({ error: 'task ini tidak punya cabang kerja' })
  const d = await diffOf({ worktree: t.worktree, base: t.base })
  if (d.error) return res.status(400).json(d)
  res.json({ branch: t.branch, ...d })
})
app.post('/api/tasks/:id/revise', control(true), (req, res) => {
  const t = claudeTask(req, res, 'review')
  if (!t) return
  if (!t.session_id) return res.status(400).json({ error: 'sesinya sudah hilang, pilih Ulangi' })
  const r = sessions.continueSession(t.session_id, req.body?.note)
  if (r.error) return res.status(400).json(r)
  updateTask(t.id, { status: 'in_progress', output: null })
  broadcast({ type: 'task-update' })
  res.json({ ok: true })
})

// daftar peran (subagent kit) untuk form task; writes: true berarti boleh mengubah file
app.get('/api/kit', control(true), (_req, res) => {
  const kit = loadKitAgents(KIT_DIR)
  res.json(Object.entries(kit).map(([name, a]) => ({
    name, description: a.description.slice(0, 160), writes: (a.tools ?? []).some((t) => ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(t)),
  })))
})
app.get('/api/history', control(true), (_req, res) => res.json(getHistory(50)))
app.get('/api/costs', control(true), (_req, res) => res.json(costSummary()))
app.get('/api/sessions', control(true), (_req, res) => res.json(sessions.list()))
app.post('/api/sessions', control(true), (req, res) => {
  const r = sessions.start({ projectId: req.body?.projectId, prompt: req.body?.prompt })
  return r.error ? res.status(400).json(r) : res.status(201).json(r)
})
app.post('/api/sessions/:id/continue', control(true), (req, res) => {
  const r = sessions.continueSession(req.params.id, req.body?.prompt)
  return r.error ? res.status(400).json(r) : res.json(r)
})
app.post('/api/sessions/:id/stop', control(true), (req, res) => {
  const r = sessions.stop(req.params.id)
  return r.error ? res.status(400).json(r) : res.json(r)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`kantor server on http://localhost:${PORT}`))
