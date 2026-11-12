import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMachineTokens } from './usage.js'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-usage-'))
const line = (id, ts, u, extra = {}) => JSON.stringify({ type: 'assistant', timestamp: ts.toISOString(), requestId: 'r' + id, message: { id: 'm' + id, usage: u }, ...extra }) + '\n'
const now = new Date()
const yesterday = new Date(new Date().setHours(0, 0, 0, 0) - 3600_000)

test('token hari ini: tanpa bacaan cache, pesan kembar dihitung sekali, kemarin dan baris rusak diabaikan', async () => {
  fs.mkdirSync(path.join(dir, 'p1'))
  fs.writeFileSync(path.join(dir, 'p1', 'a.jsonl'),
    line(1, now, { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 9999, output_tokens: 5 }) + // 115
    line(1, now, { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 9999, output_tokens: 40 }) + // pesan sama, output akhir: 150
    line(2, yesterday, { input_tokens: 777, output_tokens: 1 }) +
    'bukan json "usage"\n' +
    JSON.stringify({ type: 'user', timestamp: now.toISOString(), message: { usage: { input_tokens: 5000 } } }) + '\n')
  // sesi yang dilanjutkan: pesan 1 muncul lagi di berkas lain, ditambah pesan 3
  fs.writeFileSync(path.join(dir, 'p1', 'b.jsonl'),
    line(1, now, { input_tokens: 10, cache_creation_input_tokens: 100, output_tokens: 40 }) + line(3, now, { input_tokens: 1, output_tokens: 1 }))
  const m = createMachineTokens({ dir, maxAgeMs: 0 })
  assert.equal(m.today(), null) // belum selesai dipindai
  await m.settled()
  assert.equal(m.today(), 152)

  // baris baru ditambahkan di belakang berkas: hanya itu yang dibaca tambahan
  fs.appendFileSync(path.join(dir, 'p1', 'b.jsonl'), line(4, now, { input_tokens: 8, output_tokens: 0 }))
  m.today()
  await m.settled()
  assert.equal(m.today(), 160)
})

test('folder transkrip tidak ada: nol, tidak error', async () => {
  const m = createMachineTokens({ dir: path.join(dir, 'tidak-ada'), maxAgeMs: 0 })
  m.today()
  await m.settled()
  assert.equal(m.today(), 0)
})
