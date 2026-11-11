import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checksFor, runChecks } from './verify.js'

const dir = (scripts) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-cek-'))
  if (scripts) fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ scripts }))
  return d
}

test('yang diperiksa hanya skrip yang ada; skrip tes bawaan npm init dilewati', () => {
  assert.deepEqual(checksFor(dir(null)), [])
  assert.deepEqual(checksFor(dir({ build: 'vite build' })), ['npm run build'])
  assert.deepEqual(checksFor(dir({ test: 'echo "Error: no test specified" && exit 1', build: 'x' })), ['npm run build'])
  assert.deepEqual(checksFor(dir({ test: 'node --test', build: 'x', lint: 'y' })), ['npm test', 'npm run build'])
})

test('berhenti di perintah pertama yang gagal dan membawa ekor keluarannya', async () => {
  const d = dir({ test: 'x', build: 'y' })
  const seen = []
  const run = async (cmd) => { seen.push(cmd); return cmd === 'npm test' ? { ok: false, output: `${'a'.repeat(5000)}AKHIR` } : { ok: true, output: '' } }
  const r = await runChecks(d, { run })
  assert.deepEqual(seen, ['npm test'])
  assert.equal(r.ok, false)
  assert.equal(r.failed, 'npm test')
  assert.ok(r.output.endsWith('AKHIR') && r.output.length <= 3000)
  assert.deepEqual(await runChecks(d, { run: async () => ({ ok: true, output: '' }) }), { ran: ['npm test', 'npm run build'], ok: true })
})

test('proyek yang boleh memasang paket: npm install dijalankan dulu, dan hanya bila ada yang diperiksa', async () => {
  const seen = []
  const run = async (cmd) => { seen.push(cmd); return { ok: true, output: '' } }
  await runChecks(dir({ test: 'x' }), { run, install: true })
  assert.deepEqual(seen, ['npm install', 'npm test'])
  assert.deepEqual((await runChecks(dir({ lint: 'x' }), { run, install: true })).ran, [])
})

test('skrip sungguhan dijalankan di folder itu: lulus dan gagal terbaca dari kode keluarnya', async () => {
  assert.equal((await runChecks(dir({ test: 'node -e "process.exit(0)"' }))).ok, true)
  const bad = await runChecks(dir({ test: 'node -e "console.log(123456);process.exit(3)"' }))
  assert.equal(bad.ok, false)
  assert.match(bad.output, /123456/)
})
