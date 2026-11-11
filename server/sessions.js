// Menjalankan Claude Code tanpa layar (`claude -p`) di folder proyek yang terdaftar, dan membaca
// keluaran stream-json-nya untuk dashboard dan karakter di kantor.
//
// Catatan penting:
// - Program dijalankan langsung (tanpa shell), jadi teks tugas tidak bisa menyisipkan perintah.
// - Tugas ditaruh tepat setelah -p, sebelum opsi lain: --allowedTools menerima banyak nilai dan bisa
//   "memakan" teks tugas yang ditaruh sesudahnya.
// - Tanpa --bare, karena --bare tidak memakai login. Akibatnya hook dan MCP milik proyek ikut berjalan.
// - Mode tanpa layar tidak bisa bertanya izin: tool di luar daftar ditolak, dan jumlahnya dilaporkan.
import { spawn } from 'node:child_process'
import { describeTool, clean } from './live.js'

export const MAX_PROMPT = 4000
const MAX_KEPT = 30
const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '')
const FINISHED = new Set(['done', 'error', 'stopped'])

export function createSessions({ projects, bin = 'claude', maxRunning = 3, timeoutMs = 30 * 60 * 1000, hooks = {} }) {
  const byId = new Map()
  let counter = 0
  // hook milik pemanggil (siaran, karakter) tidak boleh menjatuhkan sesi bila error
  const emit = (name, ...a) => { try { hooks[name]?.(...a) } catch { /* abaikan */ } }
  const running = () => [...byId.values()].filter((s) => s.state === 'running' || s.state === 'stopping')

  function onLine(s, line) {
    let m
    try { m = JSON.parse(line) } catch { return }
    if (!m || typeof m !== 'object') return
    if (typeof m.session_id === 'string' && !s.claudeId) s.claudeId = m.session_id.slice(0, 80)
    if (m.type === 'system' && typeof m.subtype === 'string' && m.subtype.startsWith('task_')) {
      onSubagent(s, m)
    } else if (m.type === 'user') {
      // hasil panggilan Agent: penanda selesai cadangan bila task_notification tidak datang
      const blocks = Array.isArray(m.message?.content) ? m.message.content : []
      for (const b of blocks) {
        if (b?.type === 'tool_result' && typeof b.tool_use_id === 'string') endSubagent(s, clean(b.tool_use_id, 64), b.is_error ? 'failed' : 'done')
      }
    } else if (m.type === 'assistant') {
      const blocks = Array.isArray(m.message?.content) ? m.message.content : []
      for (const b of blocks) {
        if (b?.type === 'tool_use') {
          s.tools++
          s.activity = describeTool(b.name, b.input)
          emit('onTool', s, s.activity)
        } else if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          s.lastText = clip(b.text, 400)
          s.activity = 'Menulis jawaban'
        }
      }
      emit('onChange')
    } else if (m.type === 'result') {
      const ok = m.is_error !== true && m.subtype === 'success'
      const text = typeof m.result === 'string' ? m.result : Array.isArray(m.errors) ? m.errors.join('; ') : ''
      s.result = {
        ok,
        text: clip(text, 1000),
        turns: Number.isFinite(m.num_turns) ? m.num_turns : null,
        seconds: Number.isFinite(m.duration_ms) ? Math.round(m.duration_ms / 100) / 10 : null,
        denials: Array.isArray(m.permission_denials) ? m.permission_denials.length : 0,
        cost: Number.isFinite(m.total_cost_usd) && m.total_cost_usd >= 0 ? m.total_cost_usd : 0,
      }
      if (ok && text) s.lastText = clip(text, 400)
    }
  }

  // Subagent yang dipanggil sesi: task_started / task_progress / task_notification membawa tool_use_id panggilannya.
  // Untuk kantor hanya dipakai jenis subagent dan nama tool terakhir, bukan deskripsi bebas yang ditulis model.
  function onSubagent(s, m) {
    const id = clean(m.tool_use_id, 64)
    const type = clean(m.subagent_type, 32)
    if (!id || !type) return
    const sub = s.subagents.get(id)
    if (m.subtype === 'task_started') {
      if (sub) return
      s.subagents.set(id, { type, state: 'running' })
      emit('onSubagent', s, { kind: 'start', id, type })
    } else if (m.subtype === 'task_progress') {
      if (sub?.state !== 'running') return
      emit('onSubagent', s, { kind: 'tool', id, type, text: describeTool(m.last_tool_name, {}) })
    } else if (m.subtype === 'task_notification') {
      endSubagent(s, id, m.status === 'completed' ? 'done' : 'failed')
    } else return
    emit('onChange')
  }

  function endSubagent(s, id, state) {
    const sub = s.subagents.get(id)
    if (sub?.state !== 'running') return
    sub.state = state
    emit('onSubagent', s, { kind: 'stop', id })
    emit('onChange')
  }

  function finish(s, code, why) {
    if (s.state !== 'running' && s.state !== 'stopping') return
    // subagent yang belum sempat melapor selesai (sesi dihentikan, gagal) tidak boleh tinggal di kantor
    for (const [id, sub] of s.subagents) {
      if (sub.state === 'running') { sub.state = 'stopped'; emit('onSubagent', s, { kind: 'stop', id }) }
    }
    s.child = null
    s.endedAt = Date.now()
    if (s.stopRequested) s.state = 'stopped'
    else if (s.timedOut) { s.state = 'error'; s.error = 'melebihi batas waktu 30 menit' }
    else if (why) { s.state = 'error'; s.error = why }
    else if (s.result ? s.result.ok : code === 0) s.state = 'done'
    else { s.state = 'error'; s.error = s.result?.text || clip(s.stderr, 300).trim() || `berhenti dengan kode ${code}` }
    s.activity = { done: 'Selesai', stopped: 'Dihentikan', error: 'Gagal' }[s.state]
    emit('onStop', s)
    emit('onChange')
  }

  function launch(s, prompt, resume) {
    const project = projects.find((p) => p.id === s.projectId)
    const run = s.run
    const args = [
      '-p', prompt, '--output-format', 'stream-json', '--verbose',
      '--permission-mode', 'acceptEdits', `--allowedTools=${(run?.tools ?? project.allowedTools).join(',')}`,
      ...(run?.model ? ['--model', run.model] : []),
      ...(run?.agentsFile ? ['--agents', run.agentsFile] : []),
      ...(run?.appendPrompt ? ['--append-system-prompt', run.appendPrompt] : []),
      ...(run?.budget ? ['--max-budget-usd', String(run.budget)] : []),
      ...(resume ? ['--resume', resume] : []),
    ]
    s.subagents = new Map()
    const [cmd, argv] = /\.m?js$/.test(bin) ? [process.execPath, [bin, ...args]] : [bin, args]
    Object.assign(s, { state: 'running', activity: 'Memulai', endedAt: null, stderr: '', result: null, error: null, stopRequested: false, timedOut: false })
    let child
    try {
      child = spawn(cmd, argv, { cwd: run?.cwd ?? project.path, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    } catch {
      return finish(s, null, 'tidak bisa menjalankan claude')
    }
    s.child = child
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d
      let i
      while ((i = buf.indexOf('\n')) >= 0) { onLine(s, buf.slice(0, i)); buf = buf.slice(i + 1) }
    })
    child.stderr.on('data', (d) => { s.stderr = (s.stderr + d).slice(-400) })
    const timer = setTimeout(() => { s.timedOut = true; child.kill() }, timeoutMs)
    timer.unref()
    child.on('error', (e) => { clearTimeout(timer); finish(s, null, e.code === 'ENOENT' ? 'program claude tidak ditemukan' : 'gagal dijalankan') })
    child.on('close', (code) => { clearTimeout(timer); if (buf.trim()) onLine(s, buf); finish(s, code) })
    emit('onStart', s)
    emit('onChange')
  }

  function check(projectId, prompt) {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return { error: 'proyek tidak dikenal' }
    const text = typeof prompt === 'string' ? prompt.trim() : ''
    if (!text) return { error: 'tugas kosong' }
    if (text.length > MAX_PROMPT) return { error: `tugas terlalu panjang (maksimal ${MAX_PROMPT} huruf)` }
    if (text.startsWith('-')) return { error: 'tugas tidak boleh diawali tanda minus' }
    if (running().length >= maxRunning) return { error: `sudah ${maxRunning} sesi berjalan, tunggu salah satunya selesai`, busy: true }
    return { text }
  }

  function prune() {
    if (byId.size < MAX_KEPT) return
    for (const [id, s] of byId) if (FINISHED.has(s.state)) { byId.delete(id); if (byId.size < MAX_KEPT) return }
  }

  return {
    // run (opsional): { agentsFile, appendPrompt, budget, model, tools, cwd } untuk sesi dari papan Kanban; dipakai lagi
    // saat dilanjutkan. tools mengganti daftar izin proyek (perencana hanya membaca dan menulis rencana).
    start({ projectId, prompt, run = null }) {
      const c = check(projectId, prompt)
      if (c.error) return c
      prune()
      const p = projects.find((x) => x.id === projectId)
      const s = { id: `s${++counter}`, projectId, projectName: p.name, tools: 0, lastText: '', claudeId: null, startedAt: Date.now(), runs: 1, run, subagents: new Map() }
      byId.set(s.id, s)
      launch(s, c.text)
      return { id: s.id }
    },
    continueSession(id, prompt) {
      const s = byId.get(id)
      if (!s) return { error: 'sesi tidak ada' }
      if (!FINISHED.has(s.state)) return { error: 'sesi masih berjalan' }
      if (!s.claudeId) return { error: 'sesi ini tidak bisa dilanjutkan' }
      const c = check(s.projectId, prompt)
      if (c.error) return c
      s.runs++
      launch(s, c.text, s.claudeId)
      return { id: s.id }
    },
    stop(id) {
      const s = byId.get(id)
      if (!s || s.state !== 'running') return { error: 'sesi tidak sedang berjalan' }
      s.stopRequested = true
      s.state = 'stopping'
      s.activity = 'Menghentikan'
      s.child?.kill()
      emit('onChange')
      return { ok: true }
    },
    stopAll() { for (const s of running()) { s.stopRequested = true; s.child?.kill() } },
    list() {
      return [...byId.values()].reverse().map((s) => ({
        id: s.id, projectId: s.projectId, project: s.projectName, state: s.state, activity: s.activity,
        lastText: s.lastText, tools: s.tools, startedAt: s.startedAt, endedAt: s.endedAt, runs: s.runs,
        result: s.result, error: s.error ?? null, canContinue: FINISHED.has(s.state) && !!s.claudeId,
        subagents: [...s.subagents.values()].map(({ type, state }) => ({ type, state })),
      }))
    },
    // masih ada tempat untuk sesi baru? (dispatcher memeriksa ini sebelum menyiapkan cabang kerja)
    hasSlot() { return running().length < maxRunning },
    // id sesi Claude milik sesi dashboard: event hook dari sesi itu diabaikan karena subagent-nya sudah terbaca dari stream
    ownsClaudeId(id) {
      return typeof id === 'string' && [...byId.values()].some((s) => s.claudeId === id)
    },
    get(id) { return byId.get(id) ?? null },
  }
}
