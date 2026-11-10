import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { addProject, removeProject, setProjectChecks, loadProjects, DEFAULT_TOOLS, CHECK_TOOLS } from './projects.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-proj-'))
const dirA = path.join(tmp, 'a'); const dirB = path.join(tmp, 'b')
fs.mkdirSync(dirA); fs.mkdirSync(dirB)
const file = () => path.join(tmp, `p-${Math.random().toString(36).slice(2)}.json`)

test('menambah proyek membuat berkas dan langsung terbaca dengan izin bawaan', () => {
  const f = file()
  assert.deepEqual(addProject(f, { name: 'Proyek A', path: dirA }), { id: 'proyek-a' })
  const [p] = loadProjects(f)
  assert.equal(p.id, 'proyek-a')
  assert.equal(p.path, path.resolve(dirA))
  assert.deepEqual(p.allowedTools, DEFAULT_TOOLS)
})

test('masukan buruk ditolak dengan alasan, dan berkas tidak dibuat', () => {
  const f = file()
  const bad = (input) => addProject(f, input).error
  assert.match(bad({ name: '', path: dirA }), /nama proyek/)
  assert.match(bad({ name: 'x'.repeat(41), path: dirA }), /nama proyek/)
  assert.match(bad({ name: '---', path: dirA }), /huruf atau angka/)
  assert.match(bad({ name: 'ok', path: 'folder/relatif' }), /lengkap/)
  assert.match(bad({ name: 'ok', path: path.join(tmp, 'tidak-ada') }), /tidak ditemukan/)
  assert.match(bad({ name: 'ok', path: path.join(dirA, '..', 'a', '..', 'a') + path.sep + 'x' }), /tidak ditemukan/)
  assert.match(bad({ name: 'ok', path: path.parse(tmp).root }), /akar drive/)
  assert.match(bad({ name: 'ok', path: 123 }), /lengkap/)
  assert.match(bad(null), /nama proyek/)
  assert.equal(fs.existsSync(f), false)
})

test('berkas biasa (bukan folder) ditolak', () => {
  const f = file(); const plain = path.join(tmp, 'berkas.txt'); fs.writeFileSync(plain, 'x')
  assert.match(addProject(f, { name: 'ok', path: plain }).error, /bukan folder/)
})

test('nama kembar dan folder kembar ditolak, huruf besar kecil dianggap sama', () => {
  const f = file()
  addProject(f, { name: 'Satu', path: dirA })
  assert.match(addProject(f, { name: 'satu!', path: dirB }).error, /nama itu sudah dipakai/)
  assert.match(addProject(f, { name: 'Dua', path: dirA }).error, /folder itu sudah terdaftar/)
  if (process.platform === 'win32') assert.match(addProject(f, { name: 'Dua', path: dirA.toUpperCase() }).error, /folder itu sudah terdaftar/)
  assert.equal(loadProjects(f).length, 1)
})

test('entri yang sudah ada tetap utuh, termasuk izin khusus dan folder yang sedang tidak ada', () => {
  const f = file()
  const gone = path.join(tmp, 'disk-lepas')
  fs.writeFileSync(f, JSON.stringify([
    { name: 'Khusus', path: dirA, allowedTools: ['Read', 'Bash(git status)'] },
    { name: 'Hilang', path: gone },
  ]))
  assert.deepEqual(addProject(f, { name: 'Baru', path: dirB }), { id: 'baru' })
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'))
  assert.equal(raw.length, 3)
  assert.deepEqual(raw[0].allowedTools, ['Read', 'Bash(git status)'])
  assert.equal(raw[1].path, gone)
  assert.deepEqual(loadProjects(f).map((p) => p.id), ['khusus', 'baru']) // folder hilang tidak dimuat, tapi tidak dihapus dari berkas
})

test('berkas rusak tidak ditimpa', () => {
  const f = file(); fs.writeFileSync(f, '{ bukan json')
  assert.match(addProject(f, { name: 'ok', path: dirA }).error, /tidak bisa dibaca/)
  assert.match(removeProject(f, 'ok').error, /tidak bisa dibaca/)
  assert.equal(fs.readFileSync(f, 'utf8'), '{ bukan json')
})

test('batas jumlah proyek', () => {
  const f = file()
  fs.writeFileSync(f, JSON.stringify(Array.from({ length: 20 }, (_, i) => ({ name: `p${i}`, path: dirA }))))
  assert.match(addProject(f, { name: 'lebih', path: dirB }).error, /maksimal 20/)
})

test('menghapus proyek: hanya yang dituju, folder tidak disentuh, id tak dikenal ditolak', () => {
  const f = file()
  addProject(f, { name: 'Satu', path: dirA }); addProject(f, { name: 'Dua', path: dirB })
  assert.deepEqual(removeProject(f, 'satu'), { id: 'satu' })
  assert.deepEqual(loadProjects(f).map((p) => p.id), ['dua'])
  assert.equal(fs.existsSync(dirA), true)
  assert.match(removeProject(f, 'satu').error, /tidak ditemukan/)
  assert.match(removeProject(file(), 'apa').error, /tidak ditemukan/)
})

test('izin tes dan build: hanya dua perintah tetap, dan bisa dinyalakan serta dimatikan', () => {
  const f = file()
  addProject(f, { name: 'Biasa', path: dirA })
  addProject(f, { name: 'Dicentang', path: dirB, checks: true })
  const byId = () => Object.fromEntries(loadProjects(f).map((p) => [p.id, p]))
  assert.deepEqual(byId().biasa.allowedTools, DEFAULT_TOOLS)
  assert.deepEqual(byId().dicentang.allowedTools, [...DEFAULT_TOOLS, ...CHECK_TOOLS])
  assert.deepEqual(CHECK_TOOLS, ['Bash(npm test)', 'Bash(npm run build)'])
  assert.equal(byId().dicentang.checks, true)

  setProjectChecks(f, 'biasa', true)
  assert.deepEqual(byId().biasa.allowedTools, [...DEFAULT_TOOLS, ...CHECK_TOOLS])
  setProjectChecks(f, 'biasa', false)
  assert.deepEqual(byId().biasa.allowedTools, DEFAULT_TOOLS)
  assert.match(setProjectChecks(f, 'tidak-ada', true).error, /tidak ditemukan/)
})

test('izin khusus di berkas digabung dengan tes dan build, tanpa dobel', () => {
  const f = file()
  fs.writeFileSync(f, JSON.stringify([{ name: 'Khusus', path: dirA, checks: true, allowedTools: ['Read', 'Bash(npm test)'] }]))
  assert.deepEqual(loadProjects(f)[0].allowedTools, ['Read', 'Bash(npm test)', 'Bash(npm run build)'])
})
