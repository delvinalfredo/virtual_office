import { test } from 'node:test'
import assert from 'node:assert/strict'

// env harus terpasang sebelum db.js dimuat, makanya import dinamis
process.env.KANTOR_DB = ':memory:'
const { default: db, insertTask, updateTask, getTasksByStatus, recoverStuckTasks } = await import('./db.js')

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

  assert.deepEqual(recoverStuckTasks(), { review: 1, todo: 1 })

  assert.equal(row(work).status, 'todo')
  assert.equal(row(work).agent_id, null)
  assert.equal(row(work).progress, 0)
  assert.equal(row(rev).status, 'review')
  assert.equal(row(rev).progress, row(rev).est)
  assert.equal(row(waiting).status, 'todo')
  assert.equal(row(finished).status, 'done')
  assert.equal(row(finished).agent_id, 'qa')

  // dijalankan lagi tidak mengubah apa pun
  assert.deepEqual(recoverStuckTasks(), { review: 0, todo: 0 })
})
