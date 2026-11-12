import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { prepare, snapshot, diffOf, mergeBranch, discard, branchOf } from './gitwork.js'

let hasGit = true
try { execFileSync('git', ['--version'], { stdio: 'ignore' }) } catch { hasGit = false }
const T = { skip: !hasGit && 'git tidak terpasang' }

// realpath: di Windows TEMP bisa berbentuk nama pendek 8.3 (DELVIN~1), sedangkan git melaporkan jalur panjang,
// jadi perbandingan jalur dan junction node_modules gagal bila memakai bentuk pendek.
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'kantor-git-'))
// git berhenti mencari repo di atas folder uji; kalau tidak, folder "biasa" di dalam repo lain (misalnya home
// pengguna yang jadi repo git) dianggap repo dan tes "bukan repo" gagal.
process.env.GIT_CEILING_DIRECTORIES = path.dirname(tmp)
after(() => fs.rmSync(tmp, { recursive: true, force: true }))
const ID = ['-c', 'user.name=uji', '-c', 'user.email=uji@uji']
const git = (cwd, ...a) => execFileSync('git', [...ID, ...a], { cwd, encoding: 'utf8' })
let n = 0
// repo dengan satu commit; withModules: node_modules berisi satu berkas dan tidak di-.gitignore
const repo = ({ modules = false, sub = null } = {}) => {
  const dir = path.join(tmp, `r${++n}`)
  const proj = sub ? path.join(dir, sub) : dir
  fs.mkdirSync(proj, { recursive: true })
  git(dir, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(proj, 'a.txt'), 'satu\n')
  if (modules) { fs.mkdirSync(path.join(proj, 'node_modules', 'paket'), { recursive: true }); fs.writeFileSync(path.join(proj, 'node_modules', 'paket', 'index.js'), 'ADA') }
  git(dir, 'add', '-A', '--', ':(exclude)node_modules'); git(dir, 'commit', '-q', '-m', 'awal')
  return { dir, proj, root: path.join(tmp, `wt${n}`) }
}
// Windows bisa mengubah akhir baris saat checkout (autocrlf); yang diuji isinya, bukan akhir barisnya
const text = (p) => fs.readFileSync(p, "utf8").split(String.fromCharCode(13)).join("")
const modulesIntact = (proj) => fs.existsSync(path.join(proj, 'node_modules', 'paket', 'index.js'))

test('task bekerja di cabang sendiri: proyek utama tidak berubah, perubahan terbaca sebagai diff', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 1, projectId: 'p', root: r.root })
  assert.equal(w.branch, 'kantor/task-1')
  assert.equal(w.cwd, w.worktree)
  assert.equal(w.base, git(r.dir, 'rev-parse', 'HEAD').trim())
  fs.writeFileSync(path.join(w.cwd, 'a.txt'), 'satu\ndua\n')
  fs.writeFileSync(path.join(w.cwd, 'baru.txt'), 'x\n')
  assert.equal(text(path.join(r.proj, 'a.txt')), 'satu\n') // proyek utama utuh
  const s = await snapshot({ worktree: w.worktree, title: 'Tambah baris', taskId: 1 })
  assert.ok(s.sha && !s.empty)
  const d = await diffOf({ worktree: w.worktree, base: w.base })
  assert.deepEqual(d.files.map((f) => [f.path, f.added, f.removed]).sort(), [['a.txt', 1, 0], ['baru.txt', 1, 0]])
  assert.match(d.patch, /\+dua/)
  assert.equal(d.truncated, false)
  assert.equal(git(r.dir, 'log', '-1', '--format=%s', 'kantor/task-1').trim(), 'kantor: Tambah baris')
})

test('tanpa perubahan: snapshot kosong, tidak membuat commit', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 2, projectId: 'p', root: r.root })
  const s = await snapshot({ worktree: w.worktree, title: 'tidak ada', taskId: 2 })
  assert.equal(s.empty, true)
  assert.equal(git(r.dir, 'rev-parse', 'kantor/task-2').trim(), w.base)
})

test('node_modules dipasang lewat junction, tidak ikut commit, dan membuang worktree TIDAK menghapus isinya', T, async () => {
  const r = repo({ modules: true })
  const w = await prepare({ projectDir: r.proj, taskId: 3, projectId: 'p', root: r.root })
  assert.equal(text(path.join(w.cwd, 'node_modules', 'paket', 'index.js')), 'ADA') // tes/build bisa jalan
  fs.writeFileSync(path.join(w.cwd, 'a.txt'), 'berubah\n')
  const s = await snapshot({ worktree: w.worktree, title: 'ubah', taskId: 3 })
  const d = await diffOf({ worktree: w.worktree, base: w.base })
  assert.deepEqual(d.files.map((f) => f.path), ['a.txt']) // node_modules tidak masuk walau tidak di-.gitignore
  assert.ok(s.sha)
  assert.deepEqual(await discard({ projectDir: r.proj, worktree: w.worktree, branch: w.branch }), { ok: true })
  assert.equal(modulesIntact(r.proj), true, 'node_modules proyek asli harus selamat')
  assert.equal(fs.existsSync(w.worktree), false)
  assert.throws(() => git(r.dir, 'rev-parse', '--verify', 'kantor/task-3'), 'cabang ikut dibuang')
})

test('dua task di proyek yang sama tidak saling melihat pekerjaan', T, async () => {
  const r = repo()
  const a = await prepare({ projectDir: r.proj, taskId: 4, projectId: 'p', root: r.root })
  const b = await prepare({ projectDir: r.proj, taskId: 5, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(a.cwd, 'a.txt'), 'dari A\n')
  fs.writeFileSync(path.join(b.cwd, 'a.txt'), 'dari B\n')
  assert.equal(text(path.join(a.cwd, 'a.txt')), 'dari A\n')
  assert.equal(text(path.join(b.cwd, 'a.txt')), 'dari B\n')
  assert.equal(text(path.join(r.proj, 'a.txt')), 'satu\n')
})

test('penggabungan: masuk ke cabang aktif dengan commit gabungan', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 6, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(w.cwd, 'fitur.txt'), 'fitur\n')
  await snapshot({ worktree: w.worktree, title: 'fitur', taskId: 6 })
  const m = await mergeBranch({ projectDir: r.proj, branch: w.branch, title: 'fitur' })
  assert.deepEqual(m, { ok: true, into: 'main' })
  assert.equal(text(path.join(r.proj, 'fitur.txt')), 'fitur\n')
  assert.match(git(r.dir, 'log', '-1', '--format=%s').trim(), /^Gabungkan kantor\/task-6/)
})

test('penggabungan ditolak bila proyek punya perubahan yang belum di-commit', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 7, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(w.cwd, 'fitur.txt'), 'fitur\n')
  await snapshot({ worktree: w.worktree, title: 'fitur', taskId: 7 })
  fs.writeFileSync(path.join(r.proj, 'a.txt'), 'sedang diedit\n')
  const m = await mergeBranch({ projectDir: r.proj, branch: w.branch, title: 'fitur' })
  assert.match(m.error, /belum di-commit/)
  assert.equal(text(path.join(r.proj, 'a.txt')), 'sedang diedit\n') // pekerjaanmu tidak disentuh
  assert.equal(fs.existsSync(path.join(r.proj, 'fitur.txt')), false)
})

test('konflik: penggabungan dibatalkan dan proyek kembali bersih', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 8, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(w.cwd, 'a.txt'), 'versi task\n')
  await snapshot({ worktree: w.worktree, title: 'ubah a', taskId: 8 })
  fs.writeFileSync(path.join(r.proj, 'a.txt'), 'versi utama\n')
  git(r.dir, 'add', 'a.txt'); git(r.dir, 'commit', '-q', '-m', 'ubah di utama')
  const m = await mergeBranch({ projectDir: r.proj, branch: w.branch, title: 'ubah a' })
  assert.match(m.error, /dibatalkan.*git merge kantor\/task-8/)
  assert.equal(git(r.dir, 'status', '--porcelain').trim(), '')
  assert.equal(fs.existsSync(path.join(r.dir, '.git', 'MERGE_HEAD')), false)
  assert.equal(text(path.join(r.proj, 'a.txt')), 'versi utama\n')
})

test('proyek di subfolder repo: sesi berjalan di subfolder yang sama di dalam worktree', T, async () => {
  const r = repo({ sub: 'app', modules: true })
  const w = await prepare({ projectDir: r.proj, taskId: 9, projectId: 'p', root: r.root })
  assert.equal(w.cwd, path.join(w.worktree, 'app'))
  assert.equal(text(path.join(w.cwd, 'a.txt')), 'satu\n')
  assert.equal(fs.existsSync(path.join(w.cwd, 'node_modules', 'paket', 'index.js')), true)
  await discard({ projectDir: r.proj, worktree: w.worktree, branch: w.branch })
  assert.equal(modulesIntact(r.proj), true)
})

test('bukan repo atau repo tanpa commit: tidak dibuatkan cabang kerja', T, async () => {
  const plain = path.join(tmp, 'biasa'); fs.mkdirSync(plain)
  assert.deepEqual(await prepare({ projectDir: plain, taskId: 10, projectId: 'p', root: path.join(tmp, 'wtx') }), { notRepo: true })
  const empty = path.join(tmp, 'kosong'); fs.mkdirSync(empty); git(empty, 'init', '-q')
  assert.match((await prepare({ projectDir: empty, taskId: 11, projectId: 'p', root: path.join(tmp, 'wtx') })).error, /belum punya commit/)
})

test('menyiapkan ulang task yang sama membuang sisa cabang lama', T, async () => {
  const r = repo()
  const first = await prepare({ projectDir: r.proj, taskId: 12, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(first.cwd, 'sisa.txt'), 'lama\n')
  await snapshot({ worktree: first.worktree, title: 'lama', taskId: 12 })
  const again = await prepare({ projectDir: r.proj, taskId: 12, projectId: 'p', root: r.root })
  assert.equal(fs.existsSync(path.join(again.cwd, 'sisa.txt')), false)
  assert.equal(branchOf(12), again.branch)
})

test('folder kerja sisa tanpa tautan .git: diff dibaca dari cabangnya di proyek, bukan dari repo induk', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 14, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(w.cwd, 'baru.txt'), 'x\n')
  await snapshot({ worktree: w.worktree, title: 'baru', taskId: 14 })
  fs.rmSync(path.join(w.worktree, '.git'), { force: true }) // yang tersisa setelah worktree dilepas tapi foldernya tertahan
  const tanpa = await diffOf({ worktree: w.worktree, base: w.base })
  assert.match(tanpa.error, /sudah tidak ada/)
  const d = await diffOf({ worktree: w.worktree, base: w.base, projectDir: r.proj, branch: w.branch })
  assert.deepEqual(d.files.map((f) => f.path), ['baru.txt'])
  assert.match(d.patch, /\+x/)
})

test('diff yang sangat besar dipotong dan ditandai', T, async () => {
  const r = repo()
  const w = await prepare({ projectDir: r.proj, taskId: 13, projectId: 'p', root: r.root })
  fs.writeFileSync(path.join(w.cwd, 'besar.txt'), 'baris yang cukup panjang untuk memenuhi patch\n'.repeat(8000))
  await snapshot({ worktree: w.worktree, title: 'besar', taskId: 13 })
  const d = await diffOf({ worktree: w.worktree, base: w.base })
  assert.equal(d.truncated, true)
  assert.ok(d.patch.length <= 200 * 1024)
  assert.equal(d.files[0].added, 8000) // daftar berkas tetap lengkap
})
