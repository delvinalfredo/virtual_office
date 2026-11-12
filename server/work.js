// Pekerjaan yang dikerjakan Claude Code dari papan: task tunggal dan pekerjaan besar (satu permintaan yang
// dipecah perencana menjadi beberapa task). Semua rutenya memakai penjaga yang sama dengan sesi (komputer ini,
// Host dan Origin lokal, token), dan hasilnya hanya tampil di komputer pemilik (lihat publicTask di db.js).
//
// Alur satu task: antrian → cabang kerja sendiri → sesi Claude → server menyimpan hasil sebagai commit →
// server menjalankan tes dan build → gagal: sesi dilanjutkan untuk memperbaiki (maksimal MAX_FIX kali) →
// task tunggal menunggu keputusan pemilik; task pekerjaan besar digabung ke cabang pekerjaannya.
// Pemilik baru memutuskan sekali di akhir: menggabungkan cabang pekerjaan besar ke proyek.
import fs from 'node:fs'
import path from 'node:path'
import {
  getTasksByStatus, updateTask, getTask, getRunningTaskBySession, insertClaudeTask, logSession, getHistory, costSummary,
  insertEpic, getEpic, getEpics, getEpicBySession, getEpicTasks, updateEpic, deleteEpic, insertPlan, addEpicCost,
} from './db.js'
import { loadKitAgents, writeAgentsFile, orchestrationPrompt, shellOf, writesFiles } from './kit.js'
import { prepare as prepareWork, snapshot as saveWork, diffOf, mergeBranch, discard, syncWith, unresolved, abortMerge, repoInfo } from './gitwork.js'
import { runChecks } from './verify.js'
import { fetchAgent, saveAgent } from './catalog.js'
import { PLAN_TOOLS, MAX_EPIC_PROMPT, epicBranch, plannerPrompt, takePlan, taskPrompt, ready } from './epics.js'
import { MAX_PROMPT } from './sessions.js'

const MAX_FIX = 2 // berapa kali sesi dilanjutkan otomatis untuk memperbaiki tes gagal atau bentrokan
// berkas yang dibaca Claude Code sendiri saat sesi mulai; perubahan padanya bisa memperluas izin sesi berikutnya
const GUARDED = /(^|\/)(\.claude\/|\.mcp\.json$|CLAUDE\.md$)/
// Judul task pekerjaan besar ditulis perencana dari isi proyek, jadi tidak ikut ke log kejadian yang dibaca semua pemain
const label = (t) => (t.epic_id ? `task #${t.id}` : `"${t.title}"`)
const BUDGET_MIN = 0.5
const BUDGET_MAX = 200
const noBranch = { branch: null, worktree: null, base: null }
const parseRoles = (v) => { try { const r = JSON.parse(v); return Array.isArray(r) ? r : null } catch { return null } }
const now = () => new Date().toISOString()

export function createWork({ app, control, sessions, projects, kitDir, workRoot, logEvent, broadcast, check = runChecks, tokensToday = () => null }) {
  const BUDGET = Number(process.env.KANTOR_MAX_BUDGET)
  const MAX_BUDGET = Number.isFinite(BUDGET) && BUDGET > 0 ? BUDGET : 2
  // model sesi utama: yang menengah untuk mengerjakan, yang mahal hanya untuk merencanakan (subagent punya modelnya sendiri, lihat kit.js)
  const MODEL = process.env.KANTOR_MODEL || 'sonnet'
  const PLAN_MODEL = process.env.KANTOR_PLAN_MODEL || 'opus'

  const projectOf = (t) => projects.find((p) => p.id === t.project_id)
  const changed = () => broadcast({ type: 'task-update' })
  const verifying = new Set() // task yang sedang diperiksa server: folder kerjanya tidak boleh dibuang
  const fixes = new Map() // task id → instruksi perbaikan yang menunggu tempat sesi
  const conflicts = new Map() // task id → berkas yang tadi bentrok, diperiksa lagi setelah sesi merapikannya

  // roles: nama subagent yang dipilih (null: semua subagent kit, daftar kosong: tanpa subagent)
  function claudeRun(project, roles = null, budget = MAX_BUDGET) {
    const all = loadKitAgents(kitDir)
    const kit = roles ? Object.fromEntries(Object.entries(all).filter(([name]) => roles.includes(name))) : all
    return {
      budget, model: MODEL, staff: 'programmer',
      appendPrompt: orchestrationPrompt(kit, shellOf(project.allowedTools)),
      ...(Object.keys(kit).length && { agentsFile: writeAgentsFile(kit) }),
    }
  }

  // keepSession: sesi yang selesai normal tetap tersimpan di task, karena Revisi melanjutkannya (--resume)
  const toReview = (t, note, detail = null, keepSession = false) => {
    updateTask(t.id, { status: 'review', session_id: keepSession ? t.session_id : null, output: note, detail })
    logEvent('claude', `${label(t)}: ${note}`)
    changed()
  }

  // Membuang cabang kerja sebuah task. Proyek yang sudah tidak terdaftar tidak bisa dibersihkan dari sini.
  async function dropWork(t) {
    if (!t.worktree && !t.branch) return { ok: true }
    const project = projectOf(t)
    if (!project) return { ok: true }
    return discard({ projectDir: project.path, worktree: t.worktree, branch: t.branch })
  }

  // Menunggu sesi benar-benar berhenti, dan pemrosesan akhirnya (menyimpan commit) selesai, sebelum folder kerjanya dibuang.
  const endings = new Map() // id sesi → pemrosesan akhir sesi yang masih berjalan
  async function stopAndWait(sessionId) {
    sessions.stop(sessionId)
    for (let i = 0; i < 50; i++) {
      const s = sessions.get(sessionId)
      if (!s || (s.state !== 'running' && s.state !== 'stopping')) break
      await new Promise((r) => setTimeout(r, 100))
    }
    await endings.get(sessionId)
  }

  // ---- antrian ----
  // Task Claude jalan sampai batas sesi; sisanya menunggu. Task pekerjaan besar baru mulai setelah task yang
  // ditunggunya selesai, dan bercabang dari cabang pekerjaan besar supaya melihat hasil task sebelumnya.
  let dispatching = false
  async function dispatch() {
    if (dispatching) return
    dispatching = true
    try {
      pumpFixes()
      for (const t of getTasksByStatus('todo')) {
        if (t.mode !== 'claude') continue
        const project = projectOf(t)
        if (!project) { toReview(t, 'Proyek sudah tidak ada di daftar.'); continue }
        const epic = t.epic_id ? getEpic(t.epic_id) : null
        if (t.epic_id) {
          if (epic?.status !== 'running' || !ready(t, getEpicTasks(epic.id))) continue
          if (epic.cost >= epic.budget) { pauseEpic(epic); continue }
        }
        if (!sessions.hasSlot()) break // penuh: jangan menyiapkan cabang untuk task yang belum bisa jalan
        const run = claudeRun(project, parseRoles(t.roles), epic ? Math.min(MAX_BUDGET, Math.max(0.1, epic.budget - epic.cost)) : MAX_BUDGET)
        const work = await prepareWork({ projectDir: project.path, taskId: t.id, projectId: project.id, root: workRoot, link: !project.setup, ...(epic && { from: epic.branch }) })
        if (work.error || (epic && !work.cwd)) { toReview(t, 'Gagal menyiapkan cabang kerja.', work.error ?? 'proyek bukan repo git'); continue }
        // selama cabang disiapkan, pekerjaan besarnya bisa saja dibuang atau dihentikan
        if (epic && getEpic(epic.id)?.status !== 'running') {
          await discard({ projectDir: project.path, worktree: work.worktree, branch: work.branch })
          continue
        }
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
        updateTask(t.id, { status: 'in_progress', session_id: r.id, output: null, detail: null, checks: null })
        logEvent('claude', `mulai ${label(t)}`)
        changed()
        endedEarly(r.id)
      }
    } finally {
      dispatching = false
    }
  }

  // ---- perbaikan otomatis ----
  // Sesi task dilanjutkan dengan instruksi perbaikan. Bila tempat sesi penuh, instruksinya menunggu di sini
  // dan dicoba lagi tiap detik, lebih dulu daripada task baru.
  function queueFix(t, text) {
    updateTask(t.id, { attempts: t.attempts + 1 })
    fixes.set(t.id, text.slice(0, MAX_PROMPT))
    logEvent('claude', `memperbaiki ${label(t)}`)
    pumpFixes()
    changed()
  }
  function pumpFixes() {
    for (const [id, text] of fixes) {
      const t = getTask(id)
      if (!t || t.status !== 'in_progress') { fixes.delete(id); continue }
      const epic = t.epic_id ? getEpic(t.epic_id) : null
      if (epic) {
        // perbaikan juga tunduk pada anggaran pekerjaan: bila habis, task menunggu keputusan dan pekerjaan berhenti
        if (epic.cost >= epic.budget) {
          fixes.delete(id)
          toReview(t, 'Anggaran pekerjaan habis sebelum perbaikan otomatis', null, true)
          if (epic.status === 'running') pauseEpic(epic)
          continue
        }
        const s = sessions.get(t.session_id)
        if (s?.run) s.run = { ...s.run, budget: Math.min(MAX_BUDGET, Math.max(0.1, epic.budget - epic.cost)) }
      }
      const r = sessions.continueSession(t.session_id, text)
      if (r.busy) continue
      fixes.delete(id)
      if (r.error) toReview(t, 'Perbaikan otomatis tidak bisa dimulai.', r.error, true)
    }
  }

  // setiap akhir sesi dicatat (task, perencana, maupun manual): dasar biaya dan riwayat
  function logSessionEnd(s) {
    const t = getRunningTaskBySession(s.id)
    const epicId = t?.epic_id ?? getEpicBySession(s.id)?.id ?? null
    if (epicId && s.result?.cost) addEpicCost(epicId, s.result.cost)
    try {
      logSession({
        task_id: t?.id ?? null, epic_id: epicId,
        project: s.projectName, state: s.state, runs: s.runs, tools: s.tools,
        denials: s.result?.denials ?? 0, cost: s.result?.cost ?? 0, tokens: s.result?.tokens ?? 0, seconds: s.result?.seconds ?? null,
        subagents: JSON.stringify([...s.subagents.values()].map((x) => x.type)),
        result: s.result?.text || s.lastText || null, error: s.error ?? null,
        started_at: new Date(s.startedAt).toISOString(), ended_at: now(),
      })
    } catch { /* riwayat gagal tertulis tidak boleh menjatuhkan sesi */ }
  }

  // Sesi selesai, gagal, atau dihentikan: hasil kerjanya disimpan sebagai commit di cabang task (termasuk yang
  // belum tuntas). Sesi yang selesai normal lalu diperiksa server; sisanya langsung menunggu keputusan pemilik.
  async function sessionEnded(s) {
    logSessionEnd(s)
    const t = getRunningTaskBySession(s.id)
    if (!t) return finishPlanning(s)
    let note = { done: 'Selesai, menunggu persetujuan', stopped: 'Dihentikan', error: 'Gagal, perlu dicek' }[s.state] ?? 'Selesai'
    if (s.result?.denials) note += `, ${s.result.denials} izin ditolak`
    let detail = s.state === 'error' ? (s.error ?? null) : (s.result?.text || s.lastText || null)
    // Sesi ini tadi diminta merapikan bentrokan. Bila ia gagal, dihentikan, atau masih meninggalkan penanda konflik,
    // penggabungan yang terbuka DIBATALKAN sebelum apa pun disimpan: penanda konflik tidak boleh menjadi commit.
    const were = conflicts.get(t.id)
    conflicts.delete(t.id)
    const unmerged = Boolean(were && t.worktree && (s.state !== 'done' || unresolved(t.worktree, were).length) && await abortMerge(t.worktree))
    if (t.worktree) {
      const snap = await saveWork({ worktree: t.worktree, title: t.title, taskId: t.id })
      if (snap.error) return toReview(t, `${note}, perubahan gagal disimpan`, `${snap.error}\n\n${detail ?? ''}`.trim(), true)
    }
    const project = projectOf(t)
    if (s.state !== 'done' || !t.worktree || !project) return toReview(t, note, detail, true)
    if (unmerged) return toReview(t, 'Bentrok dengan hasil task lain dan belum berhasil dirapikan, perlu digabung manual', `Berkas yang bentrok: ${were.join(', ')}\n\n${detail ?? ''}`.trim(), true)

    // Sesi yang mengubah pengaturan Claude (subagent, hook, MCP, CLAUDE.md) tidak dilanjutkan dan tidak digabung
    // otomatis: sesi berikutnya akan memuat berkas itu, jadi pemilik yang memutuskan dulu.
    const d = await diffOf({ worktree: t.worktree, base: t.base })
    const guarded = (d.files ?? []).map((f) => f.path).filter((f) => GUARDED.test(f))
    if (guarded.length) return toReview(t, 'Mengubah berkas pengaturan Claude, perlu kamu periksa dulu', `Berkas: ${guarded.join(', ')}\n\n${detail ?? ''}`.trim(), true)

    const v = await verify(t, project, s.run?.cwd ?? t.worktree)
    if (v && !v.ok) {
      if (t.attempts < MAX_FIX) {
        return queueFix(t, `Server menjalankan '${v.failed}' di folder kerjamu dan hasilnya gagal. Perbaiki penyebabnya di kode; jangan menghapus atau melemahkan tes supaya lulus.\n\nKeluaran terakhir:\n${v.output}`)
      }
      return toReview(t, `Pemeriksaan gagal ('${v.failed}') setelah ${t.attempts} kali perbaikan`, `${v.output}\n\n${detail ?? ''}`.trim(), true)
    }
    if (v) note += `, ${v.ran.join(' dan ')} lulus`
    if (!t.epic_id) return toReview(t, note, detail, true)
    return withEpic(t.epic_id, () => integrate(getTask(t.id), project, detail))
  }

  // Tes dan build dijalankan server, hanya untuk proyek yang dicentang. null: tidak ada yang diperiksa.
  async function verify(t, project, cwd) {
    if (!project.checks) return null
    verifying.add(t.id)
    updateTask(t.id, { checks: 'jalan' })
    changed()
    let v
    try { v = await check(cwd, { install: project.setup === true }) } catch (e) { v = { ran: ['pemeriksaan'], ok: false, failed: 'pemeriksaan', output: String(e.message) } } finally { verifying.delete(t.id) }
    updateTask(t.id, { checks: !v.ran.length ? null : v.ok ? 'lulus' : 'gagal' })
    return v.ran.length ? v : null
  }

  // ---- pekerjaan besar ----
  // Penggabungan ke cabang pekerjaan besar berjalan satu per satu per pekerjaan, supaya dua task yang selesai
  // bersamaan tidak menggabung ke folder yang sama pada saat yang sama.
  const locks = new Map()
  const withEpic = (id, fn) => {
    const p = (locks.get(id) ?? Promise.resolve()).then(fn, fn)
    locks.set(id, p.catch(() => {}))
    return p
  }
  const epicCwd = async (epic, project) => {
    const info = await repoInfo(project.path)
    return info && epic.worktree && fs.existsSync(epic.worktree) ? path.join(epic.worktree, info.rel) : null
  }
  const failEpic = (id, note, detail = null) => { updateEpic(id, { status: 'failed', session_id: null, note, detail }); changed() }
  function pauseEpic(epic) {
    updateEpic(epic.id, { status: 'paused', note: `Anggaran $${epic.budget.toFixed(2)} habis. Naikkan anggaran untuk melanjutkan.` })
    logEvent(null, `pekerjaan "${epic.title}" berhenti: anggaran habis`)
    changed()
  }

  // Hasil task yang lulus pemeriksaan masuk ke cabang pekerjaan besar. Bila bentrok dengan hasil task lain, cabang
  // pekerjaan dibawa ke folder kerja task dan sesinya dilanjutkan untuk merapikan bentrokan; sesudah itu task
  // diperiksa lagi lalu digabung lagi. auto = false: dipanggil dari tombol Gabungkan, tanpa perbaikan otomatis.
  async function integrate(t, project, detail, auto = true) {
    const epic = getEpic(t.epic_id)
    const target = epic && await epicCwd(epic, project)
    if (!target) { toReview(t, 'Cabang pekerjaan besarnya sudah tidak ada.', detail, true); return { error: 'cabang pekerjaan besar sudah tidak ada' } }
    if (auto && epic.status !== 'running') { toReview(t, 'Pekerjaan besarnya sedang tidak berjalan, belum digabung', detail, true); return { error: 'pekerjaan besar sedang tidak berjalan' } }
    let m = await mergeBranch({ projectDir: target, branch: t.branch, title: t.title })
    if (m.error && auto && t.attempts < MAX_FIX) {
      const sy = await syncWith({ worktree: t.worktree, branch: epic.branch })
      if (sy.conflicts) {
        conflicts.set(t.id, sy.conflicts)
        queueFix(t, `Hasil anggota tim lain sudah masuk ke cabang pekerjaan dan bentrok dengan pekerjaanmu. Berkas ini sekarang memuat penanda konflik (<<<<<<<, =======, >>>>>>>): ${sy.conflicts.join(', ')}.\nSatukan kedua sisi supaya keduanya tetap berfungsi, lalu hapus semua penandanya. Jangan menjalankan git; server yang menutup penggabungannya.`)
        return { ok: true }
      }
      if (sy.ok) {
        // tergabung tanpa bentrok di sisi task: periksa sekali lagi karena isinya berubah, lalu gabung ulang
        const v = await verify(t, project, t.worktree && path.join(t.worktree, path.relative(epic.worktree, target)))
        m = v && !v.ok ? { error: `'${v.failed}' gagal setelah digabung dengan hasil task lain\n${v.output}` } : await mergeBranch({ projectDir: target, branch: t.branch, title: t.title })
      }
    }
    if (m.error) {
      if (auto) toReview(t, 'Bentrok dengan hasil task lain, perlu digabung manual', `${m.error}\n\n${detail ?? ''}`.trim(), true)
      return m
    }
    const d = await discard({ projectDir: project.path, worktree: t.worktree, branch: t.branch })
    updateTask(t.id, {
      status: 'done', finished_at: now(), session_id: null,
      output: d.error ? 'Masuk ke cabang pekerjaan, tetapi folder kerja belum terhapus.' : 'Masuk ke cabang pekerjaan.',
      detail: d.error ? `Folder kerja belum terhapus: ${d.error}\n\n${detail ?? ''}`.trim() : detail,
      ...(d.error ? {} : noBranch),
    })
    logEvent('claude', `${label(t)} masuk ke cabang pekerjaan`)
    const rest = getEpicTasks(epic.id)
    if (rest.every((x) => x.status === 'done')) {
      updateEpic(epic.id, { status: 'review', note: `Semua ${rest.length} task selesai. Periksa perubahannya, lalu gabungkan ke proyek.` })
      logEvent(null, `pekerjaan "${epic.title}" siap digabung ke proyek`)
    }
    changed()
    dispatch()
    return { ok: true }
  }

  // Perencana berjalan di cabang pekerjaan besar (kantor/epic-N), yang nanti menampung hasil semua task.
  async function startPlanning(epic) {
    const project = projectOf(epic)
    if (!project) return failEpic(epic.id, 'Proyek sudah tidak ada di daftar.')
    const work = await prepareWork({ projectDir: project.path, taskId: epic.id, projectId: project.id, root: workRoot, branch: epicBranch(epic.id), tag: `e${epic.id}`, link: false })
    if (!work.cwd) return failEpic(epic.id, 'Cabang pekerjaan gagal disiapkan.', work.error ?? 'Proyek ini bukan repo git. Pekerjaan besar butuh repo git yang sudah punya commit.')
    updateEpic(epic.id, { branch: work.branch, worktree: work.worktree, base: work.base })
    const r = sessions.start({
      projectId: project.id, prompt: epic.prompt,
      run: { cwd: work.cwd, budget: Math.min(MAX_BUDGET, epic.budget), model: PLAN_MODEL, tools: PLAN_TOOLS, staff: 'lead', appendPrompt: plannerPrompt(epic.id, Object.keys(loadKitAgents(kitDir))) },
    })
    if (r.error) {
      await discard({ projectDir: project.path, worktree: work.worktree, branch: work.branch })
      updateEpic(epic.id, noBranch)
      return failEpic(epic.id, 'Perencana tidak bisa dimulai.', r.error)
    }
    updateEpic(epic.id, { status: 'planning', session_id: r.id, note: null, detail: null })
    logEvent('claude', `merencanakan "${epic.title}"`)
    changed()
    endedEarly(r.id)
  }

  async function finishPlanning(s) {
    const epic = getEpicBySession(s.id)
    if (!epic) return
    if (s.state !== 'done') return failEpic(epic.id, s.state === 'stopped' ? 'Perencanaan dihentikan.' : 'Perencanaan gagal.', s.error ?? s.lastText ?? null)
    const plan = takePlan(s.run.cwd, Object.keys(loadKitAgents(kitDir)))
    if (plan.error) return failEpic(epic.id, 'Rencana tidak bisa dipakai.', plan.error)
    const snap = await saveWork({ worktree: epic.worktree, title: `rencana ${epic.title}`, taskId: `pekerjaan-${epic.id}` })
    if (snap.error) return failEpic(epic.id, 'Rencana gagal disimpan.', snap.error)
    insertPlan(epic, plan.tasks.map((t) => ({ ...t, prompt: taskPrompt(epic.id, t) })))
    updateEpic(epic.id, { status: epic.auto ? 'running' : 'planned', session_id: null, note: `${plan.tasks.length} task direncanakan.`, detail: s.result?.text || s.lastText || null })
    logEvent('claude', `rencana "${epic.title}" jadi: ${plan.tasks.length} task`)
    changed()
    dispatch()
  }

  // Pemrosesan akhir sesi tidak boleh hilang diam-diam: bila ia gagal, task diserahkan ke pemilik, bukan
  // tertinggal di "Sedang dikerjakan" tanpa tombol apa pun.
  function ended(s) {
    const p = sessionEnded(s)
      .catch((e) => {
        const t = getRunningTaskBySession(s.id)
        if (t) toReview(t, 'Gagal diproses server, perlu dicek', String(e?.message ?? e), true)
        const epic = getEpicBySession(s.id)
        if (epic) failEpic(epic.id, 'Rencana gagal diproses server.', String(e?.message ?? e))
      })
      .finally(() => { if (endings.get(s.id) === p) endings.delete(s.id) })
    endings.set(s.id, p)
    return p
  }
  // Sesi yang gagal dijalankan sejak awal sudah berakhir sebelum task atau pekerjaannya mencatat id sesinya,
  // jadi akhir sesinya diproses sekali lagi setelah id itu tercatat.
  function endedEarly(sessionId) {
    const s = sessions.get(sessionId)
    if (s && s.state !== 'running' && s.state !== 'stopping') ended(s)
  }

  const budgetOf = (v) => (Number.isFinite(Number(v)) && Number(v) >= BUDGET_MIN && Number(v) <= BUDGET_MAX ? Number(v) : null)
  const epicOr404 = (req, res, ...need) => {
    const e = getEpic(Number(req.params.id))
    if (!e) { res.status(404).json({ error: 'pekerjaan tidak ada' }); return null }
    if (need.length && !need.includes(e.status)) { res.status(400).json({ error: 'pekerjaan ini sedang tidak di tahap itu' }); return null }
    return e
  }

  app.get('/api/epics', control(true), (_req, res) => res.json(getEpics().map((e) => ({
    ...e, tasks: getEpicTasks(e.id).map(({ id, key, title, status, deps, checks, attempts }) => ({ id, key, title, status, deps: parseRoles(deps) ?? [], checks, attempts })),
  }))))
  app.post('/api/epics', control(true), (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
    if (!title) return res.status(400).json({ error: 'judul wajib' })
    if (!prompt) return res.status(400).json({ error: 'jelaskan apa yang mau dibuat' })
    if (prompt.length > MAX_EPIC_PROMPT) return res.status(400).json({ error: `penjelasan terlalu panjang (maksimal ${MAX_EPIC_PROMPT} huruf)` })
    if (prompt.startsWith('-')) return res.status(400).json({ error: 'penjelasan tidak boleh diawali tanda minus' })
    if (!projects.some((p) => p.id === req.body?.projectId)) return res.status(400).json({ error: 'proyek tidak dikenal' })
    const budget = budgetOf(req.body?.budget ?? 10)
    if (budget === null) return res.status(400).json({ error: `anggaran ${BUDGET_MIN} sampai ${BUDGET_MAX} dolar` })
    const id = insertEpic({ title, projectId: req.body.projectId, prompt, budget, auto: req.body?.auto !== false })
    logEvent(null, `pekerjaan besar baru "${title}"`)
    changed()
    startPlanning(getEpic(id)).catch((e) => failEpic(id, 'Perencana tidak bisa dimulai.', String(e.message)))
    res.status(201).json(getEpic(id))
  })
  // Jalankan rencana yang menunggu, atau lanjutkan yang berhenti karena anggaran (dengan anggaran baru).
  app.post('/api/epics/:id/run', control(true), (req, res) => {
    const e = epicOr404(req, res, 'planned', 'paused')
    if (!e) return
    const budget = req.body?.budget === undefined ? e.budget : budgetOf(req.body.budget)
    if (budget === null) return res.status(400).json({ error: `anggaran ${BUDGET_MIN} sampai ${BUDGET_MAX} dolar` })
    if (budget <= e.cost) return res.status(400).json({ error: `anggaran harus di atas yang sudah terpakai ($${e.cost.toFixed(2)})` })
    updateEpic(e.id, { status: 'running', budget, note: null })
    logEvent(null, `pekerjaan "${e.title}" dijalankan`)
    changed()
    dispatch()
    res.json({ ok: true })
  })
  app.post('/api/epics/:id/replan', control(true), (req, res) => {
    const e = epicOr404(req, res, 'failed')
    if (!e) return
    if (getEpicTasks(e.id).length) return res.status(400).json({ error: 'pekerjaan ini sudah punya task' })
    updateEpic(e.id, { status: 'planning', note: null, detail: null })
    changed()
    startPlanning(e).catch((err) => failEpic(e.id, 'Perencana tidak bisa dimulai.', String(err.message)))
    res.json({ ok: true })
  })
  app.get('/api/epics/:id/diff', control(true), async (req, res) => {
    const e = epicOr404(req, res)
    if (!e) return
    const d = await diffOf({ worktree: e.worktree, base: e.base })
    if (d.error) return res.status(400).json(d)
    res.json({ branch: e.branch, ...d })
  })
  // Keputusan akhir pemilik: cabang pekerjaan besar masuk ke cabang aktif proyek, lalu cabang dan foldernya dibuang.
  app.post('/api/epics/:id/merge', control(true), async (req, res) => {
    const e = epicOr404(req, res, 'review')
    if (!e) return
    const project = projectOf(e)
    if (!project) return res.status(400).json({ error: 'proyek sudah tidak ada di daftar' })
    const out = await withEpic(e.id, async () => {
      if (getEpic(e.id)?.status !== 'review') return { error: 'penggabungan sudah berjalan' }
      const m = await mergeBranch({ projectDir: project.path, branch: e.branch, title: e.title })
      if (m.error) return m
      const d = await discard({ projectDir: project.path, worktree: e.worktree, branch: e.branch })
      updateEpic(e.id, {
        status: 'done', finished_at: now(),
        note: d.error ? 'Digabung ke proyek, tetapi folder kerja belum terhapus.' : 'Digabung ke proyek.',
        detail: `Digabung ke cabang ${m.into}.${d.error ? `\nFolder kerja belum terhapus: ${d.error}` : ''}`,
        ...(d.error ? {} : noBranch),
      })
      logEvent(null, `pekerjaan "${e.title}" digabung ke proyek`)
      changed()
      return { ok: true, into: m.into }
    })
    return out.error ? res.status(400).json(out) : res.json(out)
  })
  // Membuang pekerjaan besar beserta semua task dan cabang kerjanya. Proyek aslinya tidak disentuh.
  app.delete('/api/epics/:id', control(true), async (req, res) => {
    const e = epicOr404(req, res)
    if (!e) return
    if (getEpicTasks(e.id).some((t) => verifying.has(t.id))) return res.status(400).json({ error: 'ada task yang sedang diperiksa, coba lagi sebentar' })
    // Antrian dan penggabungan otomatis berhenti mengambil task-nya begitu statusnya bukan running.
    updateEpic(e.id, { status: 'failed', note: 'Sedang dibuang.' })
    // Sesi dihentikan di luar kunci pekerjaan: pemrosesan akhir sesi yang selesai normal ikut mengantre di kunci itu.
    if (e.session_id) await stopAndWait(e.session_id)
    for (const t of getEpicTasks(e.id)) {
      fixes.delete(t.id)
      conflicts.delete(t.id)
      if (t.status === 'in_progress' && t.session_id) await stopAndWait(t.session_id)
    }
    const project = projectOf(e)
    const out = await withEpic(e.id, async () => {
      for (const t of getEpicTasks(e.id)) {
        const d = await dropWork(t)
        if (d.error) return d
      }
      const now = getEpic(e.id)
      if (project && now && (now.worktree || now.branch)) {
        const d = await discard({ projectDir: project.path, worktree: now.worktree, branch: now.branch })
        if (d.error) return d
      }
      deleteEpic(e.id)
      return { ok: true }
    })
    if (out.error) {
      // gagal membuang: pekerjaan dikembalikan ke keadaan berhenti yang masih bisa dijalankan atau dibuang lagi
      updateEpic(e.id, { status: getEpicTasks(e.id).length ? 'paused' : 'failed', note: `Belum terbuang: ${out.error}` })
      changed()
      return res.status(400).json(out)
    }
    logEvent(null, `pekerjaan "${e.title}" dibuang`)
    changed()
    res.json({ ok: true })
  })

  // ---- task tunggal ----
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
      const kit = Object.keys(loadKitAgents(kitDir))
      const picked = Array.isArray(req.body.roles) ? [...new Set(req.body.roles)] : null
      if (!picked || picked.some((n) => !kit.includes(n))) return res.status(400).json({ error: 'peran tidak dikenal' })
      if (picked.length === 0) return res.status(400).json({ error: 'pilih minimal satu peran' })
      if (picked.length < kit.length) roles = picked
    }
    const info = insertClaudeTask(title, req.body.projectId, prompt, roles)
    logEvent(null, `task baru "${title}" untuk Claude Code`)
    changed()
    dispatch()
    res.status(201).json(getTask(info.lastInsertRowid))
  })
  app.post('/api/tasks/:id/approve', control(true), (req, res) => {
    const t = claudeTask(req, res, 'review')
    if (!t) return
    // task pekerjaan besar baru dianggap selesai setelah hasilnya masuk ke cabang pekerjaan, karena task lain menunggunya
    if (t.epic_id) return res.status(400).json({ error: 'task ini bagian dari pekerjaan besar, pilih Gabungkan' })
    // disetujui tanpa digabung: cabang kerja tetap ada supaya bisa digabung sendiri nanti. Nama cabang tidak ditulis
    // ke output karena output task selesai terbaca semua pemain; pemilik melihatnya dari kolom branch di dialog.
    updateTask(t.id, { status: 'done', finished_at: now(), ...(t.branch && { output: 'Disetujui, belum digabung.' }) })
    logEvent(null, `"${t.title}" disetujui`)
    changed()
    res.json({ ok: true })
  })
  app.post('/api/tasks/:id/retry', control(true), async (req, res) => {
    const t = claudeTask(req, res, 'review')
    if (!t) return
    const d = await dropWork(t)
    if (d.error) return res.status(400).json(d)
    conflicts.delete(t.id)
    updateTask(t.id, { status: 'todo', session_id: null, output: null, detail: null, attempts: 0, checks: null, ...noBranch })
    logEvent(null, `${label(t)} diulang dari awal`)
    changed()
    dispatch()
    res.json({ ok: true })
  })
  // Gabungkan: cabang task masuk ke cabang aktif proyek (atau ke cabang pekerjaan besarnya), lalu cabang dan folder kerjanya dibuang
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
      if (t.epic_id) {
        const r = await withEpic(t.epic_id, () => integrate(t, project, t.detail, false))
        return r.error ? res.status(400).json(r) : res.json({ ok: true })
      }
      const m = await mergeBranch({ projectDir: project.path, branch: t.branch, title: t.title })
      if (m.error) return res.status(400).json(m)
      const d = await discard({ projectDir: project.path, worktree: t.worktree, branch: t.branch })
      // nama cabang dan pesan error (bisa memuat path) hanya ke detail, yang tidak dikirim ke pemain lain
      const into = `Digabung ke cabang ${m.into}.${d.error ? `\nFolder kerja belum terhapus: ${d.error}` : ''}`
      updateTask(t.id, {
        status: 'done', finished_at: now(), session_id: null,
        output: d.error ? 'Digabung, tetapi folder kerja belum terhapus.' : 'Digabung ke proyek.',
        detail: `${into}\n\n${t.detail ?? ''}`.trim(),
        ...(d.error ? {} : noBranch),
      })
      logEvent(null, `"${t.title}" digabung ke proyek`)
      changed()
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
    updateTask(t.id, { status: 'in_progress', output: null, attempts: 0, checks: null })
    logEvent('claude', `merevisi ${label(t)}`)
    changed()
    res.json({ ok: true })
  })

  // ---- peran tim (subagent kit) ----
  // writes: true berarti boleh mengubah file; model: model yang dipakai peran itu (kosong: ikut model sesi)
  const kitList = () => Object.entries(loadKitAgents(kitDir)).map(([name, a]) => ({ name, description: a.description.slice(0, 160), writes: writesFiles(a), model: a.model ?? null }))
  app.get('/api/kit', control(true), (_req, res) => res.json(kitList()))
  // Peran baru dari katalog aitmpl.com: pratinjau dulu, baru disimpan ke .claude/agents. Yang sudah ada tidak ditimpa.
  app.post('/api/kit/preview', control(true), async (req, res) => {
    const a = await fetchAgent(req.body?.ref)
    if (a.error) return res.status(400).json(a)
    // seluruh instruksi dikirim (berkasnya dibatasi 64 KB), supaya yang disimpan tidak lebih dari yang dibaca pemilik
    res.json({ name: a.name, description: a.def.description.slice(0, 600), tools: a.def.tools ?? [], prompt: a.def.prompt, hash: a.hash, exists: a.name in loadKitAgents(kitDir) })
  })
  app.post('/api/kit/import', control(true), async (req, res) => {
    const a = await fetchAgent(req.body?.ref)
    if (a.error) return res.status(400).json(a)
    // katalog bisa berubah di antara pratinjau dan simpan: yang disimpan harus persis yang tadi ditampilkan
    if (a.hash !== req.body?.hash) return res.status(409).json({ error: 'isi agent di katalog berubah sejak kamu melihatnya, lihat lagi isinya dulu' })
    if (a.name in loadKitAgents(kitDir)) return res.status(400).json({ error: 'peran dengan nama itu sudah ada di kit' })
    const r = saveAgent(kitDir, a.name, a.def)
    if (r.error) return res.status(400).json(r)
    res.status(201).json(kitList())
  })
  app.get('/api/history', control(true), (_req, res) => res.json(getHistory(50)))
  // token aplikasi (riwayat sesi), token seluruh Claude Code di komputer ini, dan sisa jatah akun. Membuka ini ikut
  // menyegarkan sisa jatah bila datanya sudah lama.
  const usage = () => ({ ...costSummary(), limits: sessions.limits(), tokens_machine: tokensToday() })
  app.get('/api/costs', control(true), (_req, res) => { sessions.refreshLimits(); res.json(usage()) })
  app.post('/api/usage/refresh', control(true), async (_req, res) => { await sessions.refreshLimits({ force: true }); res.json(usage()) })

  return {
    dispatch,
    sessionEnded: ended,
    // Sebelum sebuah task Claude dihapus: sesinya dihentikan dan cabang kerjanya dibuang. Mengembalikan pesan bila tidak boleh.
    async beforeDelete(t) {
      if (verifying.has(t.id)) return 'task ini sedang diperiksa, coba lagi sebentar'
      if (t.epic_id && getEpic(t.epic_id) && getEpic(t.epic_id).status !== 'done') return 'task ini bagian dari pekerjaan besar, buang lewat pekerjaannya'
      fixes.delete(t.id)
      conflicts.delete(t.id)
      if (t.status === 'in_progress' && t.session_id) await stopAndWait(t.session_id)
      return (await dropWork(t)).error ?? null
    },
    // pekerjaan yang terputus saat server mati disimpan sebagai commit supaya tidak hilang
    // (penggabungan yang masih terbuka dibatalkan dulu: daftar berkas bentroknya sudah hilang bersama server lama)
    saveInterrupted(t) { return abortMerge(t.worktree).then(() => saveWork({ worktree: t.worktree, title: t.title, taskId: t.id })).catch(() => {}) },
  }
}
