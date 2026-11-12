import { test } from 'node:test'
import assert from 'node:assert/strict'

// env harus terpasang sebelum db.js dimuat, makanya import dinamis
process.env.KANTOR_DB = ':memory:'
const { default: db, insertTask, insertClaudeTask, updateTask, getTasksByStatus, getRunningTaskBySession, recoverStuckTasks, publicTask, RESTART_NOTE, getTasks, logSession, getHistory, costSummary } = await import('./db.js')

const add = (title, est = 5) => Number(insertTask(title, est).lastInsertRowid)
const row = (id) => db.prepare('SELECT * FROM tasks WHERE id=?').get(id)

test('antrian todo: yang paling lama masuk keluar duluan', () => {
  const a = add('pertama')
  const b = add('kedua')
  const c = add('ketiga')
  assert.deepEqual(getTasksByStatus('todo').map((t) => t.id), [a, b, c])
  db.exec('DELETE FROM tasks')
})

test('recoverStuckTasks: task worker balik ke todo, review lead balik ke review', () => {
  const work = add('dikerjakan programmer', 6)
  updateTask(work, { status: 'in_progress', agent_id: 'prog1', progress: 2.5 })
  const rev = add('direview lead', 6)
  updateTask(rev, { status: 'in_progress', agent_id: 'lead', progress: 1, est: 3 })
  const waiting = add('masih antre')
  const finished = add('sudah selesai')
  updateTask(finished, { status: 'done', agent_id: 'qa' })

  assert.deepEqual(recoverStuckTasks(), { review: 1, todo: 1, claude: 0 })

  assert.equal(row(work).status, 'todo')
  assert.equal(row(work).agent_id, null)
  assert.equal(row(work).progress, 0)
  assert.equal(row(rev).status, 'review')
  assert.equal(row(rev).progress, row(rev).est)
  assert.equal(row(waiting).status, 'todo')
  assert.equal(row(finished).status, 'done')
  assert.equal(row(finished).agent_id, 'qa')

  // dijalankan lagi tidak mengubah apa pun
  assert.deepEqual(recoverStuckTasks(), { review: 0, todo: 0, claude: 0 })
  db.exec('DELETE FROM tasks')
})

test('restart: task Claude yang berjalan masuk review dengan catatan, tidak diulang; id sesi lama dilepas', () => {
  const running = Number(insertClaudeTask('jalan', 'proyek-a', 'kerjakan').lastInsertRowid)
  updateTask(running, { status: 'in_progress', session_id: 's1' })
  const reviewed = Number(insertClaudeTask('menunggu keputusan', 'proyek-a', 'x').lastInsertRowid)
  updateTask(reviewed, { status: 'review', session_id: 's2', output: 'Selesai' })
  const sim = add('simulasi')
  updateTask(sim, { status: 'in_progress', agent_id: 'prog1' })

  assert.deepEqual(recoverStuckTasks(), { review: 0, todo: 1, claude: 1 })

  assert.equal(row(running).status, 'review')
  assert.equal(row(running).output, RESTART_NOTE)
  assert.equal(row(sim).status, 'todo') // simulasi tetap diulang seperti sebelumnya
  // s1 dipakai ulang oleh server baru: task lama tidak boleh ikut terbaca sebagai pemilik sesi itu
  assert.equal(row(reviewed).session_id, null)
  assert.equal(getRunningTaskBySession('s1'), undefined)
  db.exec('DELETE FROM tasks')
})

test('pemain di jaringan tidak menerima instruksi, hasil, proyek, dan sesi task Claude', () => {
  const id = Number(insertClaudeTask('judul', 'proyek-a', 'instruksi rahasia').lastInsertRowid)
  updateTask(id, { status: 'in_progress', session_id: 's9', detail: 'isi hasil' })
  const shown = publicTask(row(id))
  assert.equal(shown.title, 'judul')
  assert.equal(shown.mode, 'claude')
  for (const k of ['prompt', 'detail', 'session_id', 'project_id']) assert.equal(k in shown, false, k)
  assert.equal(getRunningTaskBySession('s9').id, id)
  db.exec('DELETE FROM tasks')
})

const log = (over = {}) => logSession({
  task_id: null, project: 'p', state: 'done', runs: 1, tools: 1, denials: 0, cost: 0.1, seconds: 1,
  subagents: '[]', result: 'ok', error: null, started_at: new Date().toISOString(), ended_at: new Date().toISOString(), ...over,
})

test('biaya: jumlah semua sesi sebuah task, dan hari ini dipisah dari yang lama', () => {
  db.exec('DELETE FROM tasks; DELETE FROM session_log')
  const id = Number(insertClaudeTask('mahal', 'p', 'x', ['planner']).lastInsertRowid)
  log({ task_id: id, cost: 0.5, tokens: 1000 })
  log({ task_id: id, cost: 0.25, tokens: 500 }) // revisi: sesi kedua task yang sama
  log({ cost: 1, tokens: 7000, ended_at: '2020-01-01T10:00:00.000Z' }) // sesi manual lama
  assert.equal(getTasks().find((t) => t.id === id).cost, 0.75)
  const c = costSummary()
  assert.equal(c.today, 0.75)
  assert.equal(c.total, 1.75)
  assert.equal(getTasks().find((t) => t.id === id).tokens, 1500)
  assert.equal(c.tokens_today, 1500)
  assert.equal(c.tokens_total, 8500)
  assert.equal(c.runs, 3)
  assert.equal(getTasks().find((t) => t.id === id).roles, '["planner"]')
  const shown = publicTask(getTasks().find((t) => t.id === id))
  assert.equal('cost' in shown || 'tokens' in shown || 'roles' in shown, false) // biaya, token, dan peran tidak dibagikan ke jaringan
})

test('riwayat: terbaru dulu dan dipangkas ke 200 baris', () => {
  db.exec('DELETE FROM session_log')
  for (let i = 0; i < 205; i++) log({ project: `p${i}` })
  assert.equal(db.prepare('SELECT COUNT(*) c FROM session_log').get().c, 200)
  const [first] = getHistory(1)
  assert.equal(first.project, 'p204')
  assert.equal(db.prepare("SELECT COUNT(*) c FROM session_log WHERE project='p0'").get().c, 0)
  db.exec('DELETE FROM session_log; DELETE FROM tasks')
})
