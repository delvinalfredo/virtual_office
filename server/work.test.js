// Alur pekerjaan Claude dari ujung ke ujung dengan Claude palsu dan repo git sungguhan: rencana, urutan
// ketergantungan, bentrokan antar task, perbaikan otomatis setelah pemeriksaan gagal, dan batas anggaran.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from 'express'

process.env.KANTOR_DB = ':memory:'
const { getTask, getEpic, getEpicTasks } = await import('./db.js')
const { createWork } = await import('./work.js')
const { createSessions } = await import('./sessions.js')

let hasGit = true
try { execFileSync('git', ['--version'], { stdio: 'ignore' }) } catch { hasGit = false }
const T = { skip: !hasGit && 'git tidak terpasang' }

const FAKE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-claude.mjs')
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'kantor-work-'))
process.env.GIT_CEILING_DIRECTORIES = path.dirname(tmp)
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=uji', '-c', 'user.email=uji@uji', ...a], { cwd, encoding: 'utf8' })
const text = (p) => fs.readFileSync(p, 'utf8').split('\r').join('')

let n = 0
const servers = []
after(() => { for (const s of servers) s.close(); fs.rmSync(tmp, { recursive: true, force: true }) })

// satu kantor kecil per tes: proyek git baru, mesin sesi dengan Claude palsu, dan rute pekerjaan tanpa penjaga
async function office({ checks = false } = {}) {
  const dir = path.join(tmp, `p${++n}`)
  fs.mkdirSync(dir)
  git(dir, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'satu\n')
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'awal')
  const id = `p${n}`
  const projects = [{ id, name: id, path: dir, checks, allowedTools: ['Read', 'Edit'] }]
  let work
  const sessions = createSessions({ projects, bin: FAKE, hooks: { onStop: (s) => work.sessionEnded(s) } })
  const app = express()
  app.use(express.json())
  // pemeriksaan tiruan: gagal selama ada berkas rusak.txt di folder kerja
  const check = async (cwd) => (fs.existsSync(path.join(cwd, 'rusak.txt')) ? { ran: ['npm test'], ok: false, failed: 'npm test', output: 'rusak.txt ada' } : { ran: ['npm test'], ok: true })
  work = createWork({ app, control: () => (_q, _s, next) => next(), sessions, projects, kitDir: path.join(tmp, 'tanpa-kit'), workRoot: path.join(tmp, `w${n}`), logEvent: () => {}, broadcast: () => {}, check })
  const server = http.createServer(app)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  servers.push(server)
  const call = async (method, url, body) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, body: await r.json() }
  }
  // server sungguhan memanggil antrian tiap detik; di tes dipanggil tiap putaran menunggu
  const until = async (fn, ms = 20000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) { await work.dispatch(); if (fn()) return; await new Promise((r) => setTimeout(r, 40)) }
    throw new Error('waktu habis menunggu kondisi')
  }
  return { dir, id, call, until }
}
const plan = (tasks) => `buatrencana ${JSON.stringify({ tasks })}`

test('pekerjaan besar: rencana menjadi task, yang bergantung menunggu, hasilnya terkumpul lalu digabung ke proyek', T, async () => {
  const o = await office()
  const made = await o.call('POST', '/api/epics', {
    title: 'aplikasi', projectId: o.id, budget: 20,
    prompt: plan([{ key: 'dasar', title: 'Dasar', prompt: 'berkas=dasar.txt isi=d' }, { key: 'lanjut', title: 'Lanjut', prompt: 'berkas=lanjut.txt isi=l', deps: ['dasar'] }]),
  })
  assert.equal(made.status, 201)
  const id = made.body.id
  await o.until(() => getEpic(id).status === 'review')
  const [dasar, lanjut] = getEpicTasks(id)
  assert.deepEqual([dasar.status, lanjut.status], ['done', 'done'])
  assert.deepEqual(JSON.parse(lanjut.deps), [dasar.id])
  assert.ok(lanjut.finished_at >= dasar.finished_at) // yang bergantung tidak mendahului
  assert.equal(fs.existsSync(path.join(o.dir, 'dasar.txt')), false) // proyek belum disentuh sebelum pemilik memutuskan
  const e = getEpic(id)
  assert.equal(fs.existsSync(path.join(e.worktree, 'kantor-plan.json')), false) // rencana mesin tidak ikut masuk commit
  const diff = await o.call('GET', `/api/epics/${id}/diff`)
  assert.deepEqual(diff.body.files.map((f) => f.path).sort(), ['dasar.txt', 'docs/plans/rencana.md', 'lanjut.txt'])

  const merged = await o.call('POST', `/api/epics/${id}/merge`)
  assert.equal(merged.status, 200)
  assert.equal(text(path.join(o.dir, 'dasar.txt')), 'd\n')
  assert.equal(text(path.join(o.dir, 'lanjut.txt')), 'l\n')
  assert.equal(getEpic(id).status, 'done')
  assert.equal(git(o.dir, 'branch', '--list', 'kantor/*').trim(), '') // cabang kerja dibersihkan
})

test('dua task paralel mengubah berkas yang sama: bentrokan dirapikan sesi task, tanpa penanda tersisa', T, async () => {
  const o = await office()
  const { body } = await o.call('POST', '/api/epics', {
    title: 'bentrok', projectId: o.id, budget: 20,
    prompt: plan([{ key: 'kiri', title: 'Kiri', prompt: 'berkas=sama.txt isi=kiri' }, { key: 'kanan', title: 'Kanan', prompt: 'berkas=sama.txt isi=kanan' }]),
  })
  await o.until(() => getEpic(body.id).status === 'review')
  const tasks = getEpicTasks(body.id)
  assert.deepEqual(tasks.map((t) => t.status), ['done', 'done'])
  assert.equal(tasks.reduce((a, t) => a + t.attempts, 0), 1) // tepat satu task yang perlu merapikan bentrokan
  const isi = text(path.join(getEpic(body.id).worktree, 'sama.txt'))
  assert.doesNotMatch(isi, /<{7}|>{7}|={7}/)
  assert.match(isi, /kiri/)
  assert.match(isi, /kanan/)
})

test('bentrokan yang gagal dirapikan: penanda konflik tidak pernah tersimpan, task diserahkan ke pemilik', T, async () => {
  const o = await office()
  const { body } = await o.call('POST', '/api/epics', {
    title: 'bentrok keras', projectId: o.id, budget: 20,
    prompt: plan([{ key: 'kiri', title: 'Kiri', prompt: 'berkas=sama.txt isi=keras-kiri' }, { key: 'kanan', title: 'Kanan', prompt: 'berkas=sama.txt isi=keras-kanan' }]),
  })
  await o.until(() => getEpicTasks(body.id).some((t) => t.status === 'review'))
  const tasks = getEpicTasks(body.id)
  assert.deepEqual(tasks.map((t) => t.status).sort(), ['done', 'review'])
  const stuck = tasks.find((t) => t.status === 'review')
  assert.match(stuck.output, /Bentrok/)
  const marker = /<{7}|>{7}/
  assert.doesNotMatch(git(o.dir, 'show', `${stuck.branch}:sama.txt`), marker) // cabang task bersih
  assert.doesNotMatch(text(path.join(getEpic(body.id).worktree, 'sama.txt')), marker) // cabang pekerjaan bersih
  // Gabungkan dari pemilik pun ditolak selama masih bentrok, bukan memasukkan penanda
  assert.equal((await o.call('POST', `/api/tasks/${stuck.id}/merge`)).status, 400)
  assert.doesNotMatch(text(path.join(getEpic(body.id).worktree, 'sama.txt')), marker)
  assert.equal((await o.call('DELETE', `/api/epics/${body.id}`)).status, 200)
})

test('rencana yang tidak sahih menggagalkan pekerjaan tanpa membuat task, dan bisa direncanakan ulang', T, async () => {
  const o = await office()
  const { body } = await o.call('POST', '/api/epics', { title: 'salah', projectId: o.id, prompt: plan([{ key: 'b', title: 'B', prompt: 'x', deps: ['belum-ada'] }]) })
  await o.until(() => getEpic(body.id).status === 'failed')
  assert.equal(getEpicTasks(body.id).length, 0)
  assert.match(getEpic(body.id).detail, /bergantung/)
  assert.equal((await o.call('POST', `/api/epics/${body.id}/run`)).status, 400)
  assert.equal((await o.call('POST', `/api/epics/${body.id}/replan`)).status, 200)
  await o.until(() => getEpic(body.id).status === 'failed' && getEpic(body.id).session_id === null)
})

test('anggaran habis: pekerjaan berhenti sebelum task berikutnya, dan lanjut setelah anggaran dinaikkan', T, async () => {
  const o = await office()
  // Claude palsu berbiaya 0,25 per sesi: perencana + task pertama sudah menghabiskan 0,5
  const { body } = await o.call('POST', '/api/epics', {
    title: 'hemat', projectId: o.id, budget: 0.5,
    prompt: plan([{ key: 'a', title: 'A', prompt: 'berkas=x.txt isi=x' }, { key: 'b', title: 'B', prompt: 'berkas=y.txt isi=y', deps: ['a'] }]),
  })
  await o.until(() => getEpic(body.id).status === 'paused')
  assert.deepEqual(getEpicTasks(body.id).map((t) => t.status), ['done', 'todo'])
  assert.equal((await o.call('POST', `/api/epics/${body.id}/run`, { budget: 0.5 })).status, 400) // harus di atas yang terpakai
  assert.equal((await o.call('POST', `/api/epics/${body.id}/run`, { budget: 5 })).status, 200)
  await o.until(() => getEpic(body.id).status === 'review')
})

test('pemeriksaan gagal: sesi dilanjutkan untuk memperbaiki, lalu task menunggu keputusan dengan catatan lulus', T, async () => {
  const o = await office({ checks: true })
  const { body } = await o.call('POST', '/api/tasks/claude', { title: 'perbaiki', projectId: o.id, prompt: 'berkas=rusak.txt isi=x' })
  await o.until(() => getTask(body.id).status === 'review')
  const t = getTask(body.id)
  assert.equal(t.attempts, 1)
  assert.equal(t.checks, 'lulus')
  assert.match(t.output, /npm test lulus/)
})

test('pemeriksaan tetap gagal setelah dua perbaikan: berhenti dan diserahkan ke pemilik dengan keluarannya', T, async () => {
  const o = await office({ checks: true })
  const { body } = await o.call('POST', '/api/tasks/claude', { title: 'bandel', projectId: o.id, prompt: 'berkas=rusak.txt isi=bandel' })
  await o.until(() => getTask(body.id).status === 'review')
  const t = getTask(body.id)
  assert.equal(t.attempts, 2)
  assert.equal(t.checks, 'gagal')
  assert.match(t.detail, /rusak\.txt ada/)
})

test('task pekerjaan besar tidak bisa disetujui tanpa digabung, dan tidak bisa dihapus sendiri', T, async () => {
  const o = await office()
  const { body } = await o.call('POST', '/api/epics', { title: 'jaga', projectId: o.id, auto: false, prompt: plan([{ key: 'a', title: 'A', prompt: 'berkas=x.txt isi=x' }]) })
  await o.until(() => getEpic(body.id).status === 'planned')
  const [t] = getEpicTasks(body.id)
  assert.equal(t.status, 'todo') // rencana menunggu dijalankan pemilik
  assert.equal((await o.call('POST', `/api/tasks/${t.id}/approve`)).status, 400)
  assert.equal((await o.call('DELETE', `/api/epics/${body.id}`)).status, 200)
  assert.equal(getEpic(body.id), undefined)
  assert.equal(getTask(t.id), undefined)
  assert.equal(git(o.dir, 'branch', '--list', 'kantor/*').trim(), '')
})
