import fs from 'node:fs'
import path from 'node:path'

// Hanya folder yang didaftarkan di sini yang boleh dipakai sesi. Folder lain tidak bisa dipilih dari dashboard.
// Izin awal sengaja sempit: membaca dan mengedit file. Perintah shell tidak diizinkan kecuali ditambahkan
// lewat "allowedTools" per proyek.
export const DEFAULT_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Agent']
// Dua perintah tetap yang boleh dijalankan di proyek yang dicentang "tes dan build". Form hanya mengirim centang.
export const CHECK_TOOLS = ['Bash(npm test)', 'Bash(npm run build)']
const TOOL_OK = /^[\w(),:* ./-]+$/
export const MAX_PROJECTS = 20
const NAME_MAX = 40

// id proyek diturunkan dari namanya; dipakai bersama oleh pembaca dan penulis daftar supaya keduanya sepakat
export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function loadProjects(file) {
  let raw
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
  if (!Array.isArray(raw)) return []
  const out = []
  for (const p of raw) {
    const name = typeof p?.name === 'string' ? p.name.trim().slice(0, NAME_MAX) : ''
    const dir = typeof p?.path === 'string' && p.path.trim() ? path.resolve(p.path) : ''
    if (!name || !dir) continue
    try { if (!fs.statSync(dir).isDirectory()) continue } catch { continue }
    const id = slug(name) || `p${out.length + 1}`
    if (out.some((o) => o.id === id)) continue
    const tools = Array.isArray(p.allowedTools) ? p.allowedTools.filter((t) => typeof t === 'string' && TOOL_OK.test(t)).slice(0, 20) : []
    const checks = p.checks === true
    const base = tools.length ? tools : DEFAULT_TOOLS
    out.push({ id, name, path: dir, checks, allowedTools: checks ? [...new Set([...base, ...CHECK_TOOLS])] : base })
  }
  return out
}

// Daftar mentah di berkas: dibaca ulang tiap kali diubah, jadi entri yang foldernya sedang tidak ada (disk lepas)
// ikut tertulis kembali, tidak hilang. Berkas yang ada tetapi rusak tidak ditimpa.
function readRaw(file) {
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch (e) { return e.code === 'ENOENT' ? [] : null }
  try { const raw = JSON.parse(text); return Array.isArray(raw) ? raw : null } catch { return null }
}

function writeRaw(file, raw) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(raw, null, 2)}
`)
  fs.renameSync(tmp, file)
}

const sameDir = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)
const BROKEN = 'projects.json tidak bisa dibaca, perbaiki atau hapus berkasnya dulu'

// Menambah satu proyek ke berkas. Folder harus alamat lengkap yang ada; akar drive ditolak karena terlalu luas.
// Izin tool tidak bisa diatur dari sini: proyek baru selalu memakai DEFAULT_TOOLS.
export function addProject(file, input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name || name.length > NAME_MAX) return { error: `nama proyek harus 1 sampai ${NAME_MAX} huruf` }
  if (!slug(name)) return { error: 'nama proyek harus memuat huruf atau angka' }
  const given = typeof input?.path === 'string' ? input.path.trim() : ''
  if (!given || !path.isAbsolute(given)) return { error: 'alamat folder harus lengkap, misalnya D:/Kodingan/proyek-satu' }
  const dir = path.resolve(given)
  if (path.parse(dir).root === dir) return { error: 'pilih folder proyeknya, bukan akar drive' }
  try { if (!fs.statSync(dir).isDirectory()) return { error: 'alamat itu bukan folder' } } catch { return { error: 'folder tidak ditemukan' } }
  const raw = readRaw(file)
  if (raw === null) return { error: BROKEN }
  if (raw.length >= MAX_PROJECTS) return { error: `maksimal ${MAX_PROJECTS} proyek` }
  const id = slug(name)
  for (const r of raw) {
    if (typeof r?.name === 'string' && slug(r.name.trim().slice(0, NAME_MAX)) === id) return { error: 'nama itu sudah dipakai proyek lain' }
    if (typeof r?.path === 'string' && r.path.trim() && sameDir(path.resolve(r.path), dir)) return { error: 'folder itu sudah terdaftar' }
  }
  raw.push(input?.checks === true ? { name, path: dir, checks: true } : { name, path: dir })
  writeRaw(file, raw)
  return { id }
}

// Mengubah izin "tes dan build" proyek yang sudah ada.
export function setProjectChecks(file, id, checks) {
  const raw = readRaw(file)
  if (raw === null) return { error: BROKEN }
  const at = raw.findIndex((r) => typeof r?.name === 'string' && slug(r.name.trim().slice(0, NAME_MAX)) === id)
  if (at < 0) return { error: 'proyek tidak ditemukan' }
  if (checks === true) raw[at].checks = true
  else delete raw[at].checks
  writeRaw(file, raw)
  return { id }
}

// Menghapus satu proyek menurut id. Hanya mengubah daftar; folder dan sesi lama tidak disentuh.
export function removeProject(file, id) {
  const raw = readRaw(file)
  if (raw === null) return { error: BROKEN }
  const at = raw.findIndex((r) => typeof r?.name === 'string' && slug(r.name.trim().slice(0, NAME_MAX)) === id)
  if (at < 0) return { error: 'proyek tidak ditemukan' }
  raw.splice(at, 1)
  writeRaw(file, raw)
  return { id }
}
