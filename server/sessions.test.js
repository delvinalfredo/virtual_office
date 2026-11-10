import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSessions, MAX_PROMPT } from './sessions.js'
import { loadProjects, DEFAULT_TOOLS } from './projects.js'

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-claude.mjs')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-uji-'))
const dirA = path.join(tmp, 'proyek-a')
fs.mkdirSync(dirA)
const projects = [{ id: 'a', name: 'proyek-a', path: dirA, allowedTools: ['Read', 'Edit'] }]
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

const waitFor = async (fn, ms = 8000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (fn()) return; await new Promise((r) => setTimeout(r, 25)) }
  throw new Error('waktu habis menunggu kondisi')
}
const make = (extra = {}) => {
  const events = []
  const sessions = createSessions({
    projects, bin: FAKE, ...extra,
    hooks: {
      onStart: (s) => events.push(['start', s.projectName]),
      onTool: (s, text) => events.push(['tool', text]),
      onStop: (s) => events.push(['stop', s.state]),
      ...extra.hooks,
    },
  })
  return { sessions, events }
}
const get = (sessions, id) => sessions.list().find((s) => s.id === id)

test('sesi berjalan di folder proyek dengan izin sempit, dan tugas tepat setelah -p', async () => {
  const { sessions, events } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'periksa README' })
  await waitFor(() => get(sessions, id).state === 'done')
  const s = get(sessions, id)
  assert.equal(s.result.ok, true)
  const cwd = s.result.text.match(/cwd=(.*?) \| args=/)[1]
  assert.equal(fs.realpathSync.native(cwd), fs.realpathSync.native(dirA))
  const args = JSON.parse(s.result.text.split('args=')[1])
  assert.deepEqual(args.slice(0, 3), ['--output-format', 'stream-json', '--verbose'])
  assert.ok(args.includes('--permission-mode') && args[args.indexOf('--permission-mode') + 1] === 'acceptEdits')
  assert.ok(args.includes('--allowedTools=Read,Edit'))
  assert.ok(!args.includes('--bare'), 'tidak boleh --bare karena melewati login')
  assert.equal(s.tools, 2)
  assert.equal(s.canContinue, true)
  assert.deepEqual(events.map((e) => e[0]), ['start', 'tool', 'tool', 'stop'])
})

test('aktivitas hanya memuat nama file dan kata pertama perintah, bukan isi', async () => {
  const { sessions, events } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'apa saja' })
  await waitFor(() => get(sessions, id).state === 'done')
  const shown = JSON.stringify(events) + JSON.stringify(sessions.list().map((s) => s.activity))
  assert.ok(events.some((e) => e[1] === 'Membaca README.md'))
  assert.ok(events.some((e) => e[1] === 'Menjalankan curl'))
  assert.ok(!shown.includes('RAHASIA'), 'isi tool atau perintah lengkap bocor')
})

test('masukan tidak sah ditolak sebelum proses apa pun berjalan', () => {
  const { sessions } = make()
  assert.match(sessions.start({ projectId: 'tidak-ada', prompt: 'x' }).error, /proyek/)
  assert.match(sessions.start({ projectId: 'a', prompt: '   ' }).error, /kosong/)
  assert.match(sessions.start({ projectId: 'a', prompt: 'x'.repeat(MAX_PROMPT + 1) }).error, /panjang/)
  assert.match(sessions.start({ projectId: 'a', prompt: '--bare lalu hapus' }).error, /minus/)
  assert.match(sessions.start({ projectId: '../../etc', prompt: 'x' }).error, /proyek/)
  assert.equal(sessions.list().length, 0)
})

test('izin yang ditolak dilaporkan, dan kegagalan menampilkan alasan', async () => {
  const { sessions } = make()
  const a = sessions.start({ projectId: 'a', prompt: 'tolak ini' }).id
  const b = sessions.start({ projectId: 'a', prompt: 'ada error' }).id
  await waitFor(() => get(sessions, a).state === 'done' && get(sessions, b).state === 'error')
  assert.equal(get(sessions, a).result.denials, 1)
  assert.match(get(sessions, b).error, /boom|kode 1/)
})

test('batas sesi berjalan bersamaan, dan hentikan mematikan prosesnya', async () => {
  const { sessions } = make({ maxRunning: 2 })
  const ids = [sessions.start({ projectId: 'a', prompt: 'lama 1' }).id, sessions.start({ projectId: 'a', prompt: 'lama 2' }).id]
  assert.match(sessions.start({ projectId: 'a', prompt: 'lama 3' }).error, /sudah 2 sesi/)
  assert.equal(sessions.stop(ids[0]).ok, true)
  await waitFor(() => get(sessions, ids[0]).state === 'stopped')
  assert.equal(get(sessions, ids[1]).state, 'running')
  // setelah satu berhenti, satu slot kosong lagi
  const again = sessions.start({ projectId: 'a', prompt: 'lama 4' })
  assert.ok(again.id)
  sessions.stopAll()
  await waitFor(() => sessions.list().every((s) => s.state !== 'running' && s.state !== 'stopping'))
  assert.match(sessions.stop('s999').error, /tidak sedang berjalan/)
})

test('lanjutkan memakai --resume dengan id sesi dari Claude, dan hanya setelah selesai', async () => {
  const { sessions } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'langkah satu' })
  assert.match(sessions.continueSession(id, 'langkah dua').error, /masih berjalan/)
  await waitFor(() => get(sessions, id).state === 'done')
  assert.equal(sessions.continueSession(id, 'langkah dua').id, id)
  await waitFor(() => get(sessions, id).state === 'done' && get(sessions, id).runs === 2)
  const args = JSON.parse(get(sessions, id).result.text.split('args=')[1])
  assert.equal(args[args.indexOf('--resume') + 1], 'fake-sess-1')
  assert.match(sessions.continueSession('s999', 'x').error, /tidak ada/)
})

test('program claude yang tidak ada menghasilkan galat yang jelas, bukan crash', async () => {
  const s = createSessions({ projects, bin: path.join(tmp, 'tidak-ada.exe') })
  const { id } = s.start({ projectId: 'a', prompt: 'x' })
  await waitFor(() => get(s, id).state === 'error')
  assert.match(get(s, id).error, /tidak ditemukan/)
})

test('loadProjects: hanya folder yang ada, nama jadi id, izin awal sempit, alat aneh disaring', () => {
  const file = path.join(tmp, 'projects.json')
  fs.writeFileSync(file, JSON.stringify([
    { name: 'Proyek A', path: path.join(tmp, 'proyek-a') },
    { name: 'Hilang', path: path.join(tmp, 'tidak-ada') },
    { name: 'Proyek A', path: path.join(tmp, 'proyek-a') },
    { name: 'Dengan Alat', path: tmp, allowedTools: ['Read', 'Bash(git *)', 'rm -rf /; $(x)', 42] },
    { path: tmp },
  ]))
  const list = loadProjects(file)
  assert.deepEqual(list.map((p) => p.id), ['proyek-a', 'dengan-alat'])
  assert.deepEqual(list[0].allowedTools, DEFAULT_TOOLS)
  assert.deepEqual(list[1].allowedTools, ['Read', 'Bash(git *)'])
  assert.deepEqual(loadProjects(path.join(tmp, 'tidak-ada.json')), [])
})

test('subagent: muncul, memakai tool, selesai; yang tak sempat melapor dihentikan saat sesi berakhir', async () => {
  const sub = []
  const { sessions } = make({ hooks: { onSubagent: (_s, ev) => sub.push(`${ev.kind}:${ev.id}${ev.text ? ':' + ev.text : ''}`) } })
  const { id } = sessions.start({ projectId: 'a', prompt: 'jalankan subagen menggantung' })
  await waitFor(() => get(sessions, id).state === 'done')
  assert.deepEqual(sub, [
    'start:tu-a', 'start:tu-b',
    'tool:tu-a:Membaca', // nama tool saja; deskripsi bebas dan path dari model tidak dipakai
    'stop:tu-a',
    'stop:tu-b', // tak pernah melapor selesai, dihentikan saat sesi berakhir
  ])
  assert.deepEqual(get(sessions, id).subagents, [{ type: 'planner', state: 'done' }, { type: 'tdd-guide', state: 'stopped' }])
  assert.ok(!JSON.stringify(sessions.list()).includes('RAHASIA'))
})

test('subagent yang gagal dilaporkan berhenti, bukan selesai', async () => {
  const { sessions } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'jalankan subagen' })
  await waitFor(() => get(sessions, id).state === 'done')
  assert.deepEqual(get(sessions, id).subagents.map((x) => x.state), ['done', 'failed'])
})

test('sesi dari papan Kanban membawa subagent kit, instruksi, dan batas biaya; sesi biasa tidak', async () => {
  const { sessions } = make()
  const plain = sessions.start({ projectId: 'a', prompt: 'biasa' })
  const kanban = sessions.start({ projectId: 'a', prompt: 'dari papan', run: { agentsFile: '/tmp/a.json', appendPrompt: 'aturan kerja', budget: 2 } })
  await waitFor(() => get(sessions, plain.id).state === 'done' && get(sessions, kanban.id).state === 'done')
  const args = (id) => JSON.parse(get(sessions, id).result.text.split('args=')[1])
  const k = args(kanban.id)
  assert.equal(k[k.indexOf('--agents') + 1], '/tmp/a.json')
  assert.equal(k[k.indexOf('--append-system-prompt') + 1], 'aturan kerja')
  assert.equal(k[k.indexOf('--max-budget-usd') + 1], '2')
  const p = args(plain.id)
  for (const flag of ['--agents', '--append-system-prompt', '--max-budget-usd']) assert.equal(p.includes(flag), false, flag)
  // dilanjutkan tetap membawa pengaturan yang sama
  sessions.continueSession(kanban.id, 'lanjut')
  await waitFor(() => get(sessions, kanban.id).runs === 2 && get(sessions, kanban.id).state === 'done')
  assert.ok(args(kanban.id).includes('--agents'))
})

test('ownsClaudeId mengenali sesi dashboard, bukan id sembarang', async () => {
  const { sessions } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'apa saja' })
  await waitFor(() => get(sessions, id).state === 'done')
  assert.equal(sessions.ownsClaudeId('fake-sess-1'), true)
  assert.equal(sessions.ownsClaudeId('lain'), false)
  assert.equal(sessions.ownsClaudeId(undefined), false)
})

test('penuh: galat ditandai busy supaya antrean menunggu, bukan menggagalkan task', async () => {
  const { sessions } = make({ maxRunning: 1 })
  const first = sessions.start({ projectId: 'a', prompt: 'lama sekali' })
  const second = sessions.start({ projectId: 'a', prompt: 'kedua' })
  assert.equal(second.busy, true)
  assert.equal(sessions.start({ projectId: 'tidak-ada', prompt: 'x' }).busy, undefined)
  sessions.stop(first.id)
  await waitFor(() => get(sessions, first.id).state === 'stopped')
})

test('subagent tanpa task_notification dianggap selesai dari hasil panggilan Agent-nya', async () => {
  const stops = []
  const { sessions } = make({ hooks: { onSubagent: (_s, ev) => { if (ev.kind === 'stop') stops.push(ev.id) } } })
  const { id } = sessions.start({ projectId: 'a', prompt: 'jalankan subagen hasilsaja' })
  await waitFor(() => get(sessions, id).state === 'done')
  assert.deepEqual(get(sessions, id).subagents.map((x) => x.state), ['done', 'done'])
  assert.deepEqual(stops, ['tu-a', 'tu-b']) // tidak ada henti ganda saat sesi berakhir
})

test('biaya sesi dibaca dari hasil; tanpa angka sahih dianggap nol', async () => {
  const { sessions } = make()
  const { id } = sessions.start({ projectId: 'a', prompt: 'hitung biaya' })
  await waitFor(() => get(sessions, id).state === 'done')
  assert.equal(get(sessions, id).result.cost, 0.25)
})
