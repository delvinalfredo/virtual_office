// Proyek baru dari nol: folder baru, repo git, kit (.claude, CLAUDE.md), commit pertama, lalu masuk daftar proyek.
// Folder induk datang dari klien (pemilik komputer), jadi diperiksa seperti alamat proyek: lengkap dan memang ada.
// Folder yang sudah ada tidak pernah dipakai, supaya tidak ada isi yang tertimpa.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { addProject, slug } from './projects.js'
import { installKit } from './kit.js'

const run = promisify(execFile)
const IDENT = ['-c', 'user.name=Kantor Virtual', '-c', 'user.email=kantor@localhost']
const IGNORE = 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n'

async function git(cwd, args) {
  try { await run('git', args, { cwd, timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }); return null } catch (e) { return String(e.stderr || e.message || 'gagal').trim().split('\n')[0] }
}

// { id, path } atau { error }. Izin tes dan build (checks) serta pasang paket (setup) hanya diberikan bila
// pemilik mencentangnya di form: keduanya berarti menjalankan kode di komputer ini.
export async function createProject(file, { name, parent, kitRoot, checks = false, setup = false }) {
  const clean = typeof name === 'string' ? name.trim() : ''
  const id = slug(clean)
  if (!id) return { error: 'nama proyek harus memuat huruf atau angka' }
  const given = typeof parent === 'string' ? parent.trim() : ''
  if (!given || !path.isAbsolute(given)) return { error: 'folder induk harus alamat lengkap, misalnya D:/Kodingan' }
  const root = path.resolve(given)
  try { if (!fs.statSync(root).isDirectory()) return { error: 'folder induk itu bukan folder' } } catch { return { error: 'folder induk tidak ditemukan' } }
  const dir = path.join(root, id)
  if (fs.existsSync(dir)) return { error: `folder ${id} sudah ada di sana, pakai Tambah proyek untuk mendaftarkannya` }
  try { fs.mkdirSync(dir) } catch { return { error: 'folder proyek tidak bisa dibuat' } }

  const fail = (error) => {
    // hanya folder yang baru saja dibuat fungsi ini yang dibersihkan
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* biarkan, pesan error sudah cukup */ }
    return { error }
  }
  const kit = installKit(kitRoot, dir)
  if (kit.error) return fail(kit.error)
  fs.writeFileSync(path.join(dir, '.gitignore'), IGNORE)
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${clean}\n`)
  let err = await git(dir, ['init', '-q'])
  if (!err) err = await git(dir, ['add', '-A'])
  if (err) return fail(`repo git gagal dibuat: ${err}`)
  const msg = 'awal: proyek baru dari Kantor Virtual'
  err = await git(dir, ['commit', '-q', '--no-verify', '-m', msg])
  if (err) err = await git(dir, [...IDENT, 'commit', '-q', '--no-verify', '-m', msg])
  if (err) return fail(`commit pertama gagal: ${err}`)

  const added = addProject(file, { name: clean, path: dir, checks, setup })
  if (added.error) return fail(added.error)
  return { id: added.id, path: dir }
}
