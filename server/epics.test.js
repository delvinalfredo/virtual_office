import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlan, ready, MAX_TASKS } from './epics.js'

const plan = (tasks) => parsePlan(JSON.stringify({ tasks }), ['tdd-guide', 'planner'])
const ok = { key: 'a', title: 'A', prompt: 'kerjakan a' }

test('rencana sahih dirapikan: peran tak dikenal dan berkas di luar proyek dibuang', () => {
  const r = plan([ok, { key: 'b', title: '  B   dua ', prompt: 'kerjakan b', deps: ['a', 'a'], files: ['src/b.js', '../luar.js', '/etc/passwd', 'C:/x'], roles: ['tdd-guide', 'hantu'] }])
  assert.equal(r.error, undefined)
  assert.deepEqual(r.tasks[0], { key: 'a', title: 'A', prompt: 'kerjakan a', deps: [], files: [], roles: [] })
  assert.deepEqual(r.tasks[1], { key: 'b', title: 'B dua', prompt: 'kerjakan b', deps: ['a'], files: ['src/b.js'], roles: ['tdd-guide'] })
})

test('rencana ditolak: bukan JSON, kosong, terlalu banyak, key buruk atau kembar, tanpa instruksi', () => {
  assert.match(parsePlan('bukan json', []).error, /JSON/)
  assert.match(plan([]).error, /tidak memuat task/)
  assert.match(plan(Array.from({ length: MAX_TASKS + 1 }, (_, i) => ({ ...ok, key: `t${i}` }))).error, /maksimal/)
  assert.match(plan([{ ...ok, key: 'Huruf Besar' }]).error, /key/)
  assert.match(plan([ok, ok]).error, /kembar/)
  assert.match(plan([{ key: 'a', title: 'A' }]).error, /instruksi/)
})

test('ketergantungan hanya ke task di atasnya, jadi rencana tidak bisa melingkar', () => {
  assert.match(plan([{ ...ok, deps: ['a'] }]).error, /bergantung/) // pada dirinya sendiri
  assert.match(plan([{ ...ok, deps: ['b'] }, { ...ok, key: 'b', deps: ['a'] }]).error, /bergantung/)
})

test('task boleh mulai hanya setelah semua yang ditunggunya selesai', () => {
  const all = [{ id: 1, status: 'done' }, { id: 2, status: 'review' }]
  assert.equal(ready({ deps: '[]' }, all), true)
  assert.equal(ready({ deps: null }, all), true)
  assert.equal(ready({ deps: '[1]' }, all), true)
  assert.equal(ready({ deps: '[1,2]' }, all), false)
  assert.equal(ready({ deps: '[9]' }, all), false) // task yang ditunggu sudah tidak ada
})
