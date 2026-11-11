import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createProject } from './scaffold.js'
import { loadProjects, CHECK_TOOLS, SETUP_TOOLS } from './projects.js'

let hasGit = true
try { execFileSync('git', ['--version'], { stdio: 'ignore' }) } catch { hasGit = false }
const T = { skip: !hasGit && 'git tidak terpasang' }
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'kantor-baru-'))
process.env.GIT_CEILING_DIRECTORIES = path.dirname(tmp)
after(() => fs.rmSync(tmp, { recursive: true, force: true }))
const kitRoot = path.join(tmp, 'kit')
fs.mkdirSync(path.join(kitRoot, '.claude', 'agents'), { recursive: true })
fs.writeFileSync(path.join(kitRoot, '.claude', 'agents', 'planner.md'), 'peran')
fs.writeFileSync(path.join(kitRoot, 'CLAUDE.md'), 'aturan')
const file = path.join(tmp, 'projects.json')

test('proyek baru: folder, kit, repo git dengan commit pertama, dan terdaftar dengan izin yang dicentang', T, async () => {
  const r = await createProject(file, { name: 'Toko Online', parent: tmp, kitRoot, checks: true, setup: true })
  assert.equal(r.id, 'toko-online')
  assert.equal(r.path, path.join(tmp, 'toko-online'))
  assert.ok(fs.existsSync(path.join(r.path, '.claude', 'agents', 'planner.md')))
  assert.ok(fs.existsSync(path.join(r.path, 'CLAUDE.md')))
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: r.path, encoding: 'utf8' }).trim(), '') // semuanya sudah di commit pertama
  assert.equal(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: r.path, encoding: 'utf8' }).trim(), '1')
  const [p] = loadProjects(file)
  for (const t of [...CHECK_TOOLS, ...SETUP_TOOLS]) assert.ok(p.allowedTools.includes(t), t)
})

test('tanpa centang, proyek baru tidak mendapat izin perintah shell apa pun', T, async () => {
  await createProject(file, { name: 'Tanpa Izin', parent: tmp, kitRoot })
  const p = loadProjects(file).find((x) => x.id === 'tanpa-izin')
  assert.equal(p.allowedTools.some((t) => t.startsWith('Bash')), false)
})

test('folder yang sudah ada tidak dipakai dan tidak diubah; folder induk harus alamat lengkap yang ada', T, async () => {
  const ada = path.join(tmp, 'sudah-ada')
  fs.mkdirSync(ada)
  fs.writeFileSync(path.join(ada, 'penting.txt'), 'jangan hilang')
  assert.match((await createProject(file, { name: 'Sudah Ada', parent: tmp, kitRoot })).error, /sudah ada/)
  assert.deepEqual(fs.readdirSync(ada), ['penting.txt'])
  assert.match((await createProject(file, { name: 'x', parent: 'relatif/saja', kitRoot })).error, /alamat lengkap/)
  assert.match((await createProject(file, { name: 'x', parent: path.join(tmp, 'tidak-ada'), kitRoot })).error, /tidak ditemukan/)
  assert.match((await createProject(file, { name: '///', parent: tmp, kitRoot })).error, /huruf atau angka/)
})

test('nama yang sudah terdaftar: folder yang baru dibuat dibersihkan lagi', T, async () => {
  const lain = path.join(tmp, 'induk-lain')
  fs.mkdirSync(lain)
  assert.match((await createProject(file, { name: 'Toko Online', parent: lain, kitRoot })).error, /sudah dipakai/)
  assert.deepEqual(fs.readdirSync(lain), [])
})
