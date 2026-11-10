// Cabang kerja per task Claude: tiap task bekerja di git worktree sendiri (cabang kantor/task-N), jadi beberapa
// sesi di proyek yang sama tidak saling menimpa, perubahannya bisa dilihat sebagai diff sebelum disetujui, dan
// "Ulangi" cukup membuang cabangnya. Semua perintah git dijalankan tanpa shell dengan argumen dari server
// (nama cabang dibuat dari nomor task), jadi teks task tidak bisa menyisipkan perintah.
//
// PERINGATAN: node_modules proyek dipasang ke worktree lewat junction supaya tes dan build jalan. Di Windows,
// `git worktree remove` yang berjalan selagi junction masih terpasang MENGHAPUS ISI node_modules proyek asli
// (sudah dibuktikan). Karena itu setiap pembuangan melepas junction dulu, dan berhenti bila gagal.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const MAX_PATCH = 200 * 1024
const IDENT = ['-c', 'user.name=Kantor Virtual', '-c', 'user.email=kantor@localhost']

export const branchOf = (taskId) => `kantor/task-${taskId}`

async function git(cwd, args, timeout = 120000) {
  try {
    const { stdout, stderr } = await run('git', args, { cwd, timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true })
    return { ok: true, out: stdout, err: stderr }
  } catch (e) {
    return { ok: false, out: e.stdout ?? '', err: String(e.stderr || e.message || '').trim() }
  }
}
const firstLine = (s) => String(s).split('\n').find((l) => l.trim()) ?? 'gagal'

// { top, rel } bila dir ada di dalam repo git; rel = lokasi proyek relatif terhadap akar repo
export async function repoInfo(dir) {
  const r = await git(dir, ['rev-parse', '--show-toplevel'])
  if (!r.ok) return null
  const top = path.resolve(r.out.trim())
  return { top, rel: path.relative(top, path.resolve(dir)) }
}

// Menelusuri worktree mencari tautan (junction atau symlink), kecuali isi .git. Dipakai sebelum menghapus folder
// dengan cara lain selain git, supaya tidak pernah menghapus isi yang ditunjuk tautan.
function findLinks(root, depth = 4) {
  const found = []
  const walk = (dir, d) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name === '.git') continue
      const p = path.join(dir, e.name)
      if (e.isSymbolicLink()) found.push(p)
      else if (e.isDirectory() && d < depth) walk(p, d + 1)
    }
  }
  walk(root, 0)
  return found
}

function unlinkNodeModules(wt, rel) {
  const link = path.join(wt, rel, 'node_modules')
  let st
  try { st = fs.lstatSync(link) } catch { return true }
  if (!st.isSymbolicLink()) return true
  try { fs.unlinkSync(link); return true } catch { return false }
}

// Menyiapkan worktree untuk task. Mengembalikan { cwd, worktree, branch, base } atau { error }.
export async function prepare({ projectDir, taskId, projectId, root }) {
  const info = await repoInfo(projectDir)
  if (!info) return { notRepo: true }
  const head = await git(info.top, ['rev-parse', 'HEAD'])
  if (!head.ok) return { error: 'repo belum punya commit, buat commit pertama dulu' }
  const base = head.out.trim()
  const branch = branchOf(taskId)
  // Nama folder unik per percobaan: di Windows folder yang baru dihapus bisa tertahan sebentar dan menolak dibuat ulang.
  const wt = path.join(root, `${projectId}-t${taskId}-${Date.now().toString(36)}`)
  // sisa percobaan sebelumnya untuk task yang sama (worktree dan cabangnya) dibuang dulu
  const list = await git(info.top, ['worktree', 'list', '--porcelain'])
  const NL = String.fromCharCode(10)
  for (const block of list.out.split(String.fromCharCode(13)).join("").split(NL + NL)) {
    const dir = /^worktree (.+)$/m.exec(block)?.[1]
    if (dir && new RegExp(`^branch refs/heads/${branch}$`, 'm').test(block)) {
      const old = await discard({ projectDir, worktree: path.resolve(dir), branch })
      if (old.error) return old
    }
  }
  await git(info.top, ['branch', '-D', branch])
  fs.mkdirSync(root, { recursive: true })
  const add = await git(info.top, ['worktree', 'add', '-q', '-b', branch, wt, 'HEAD'])
  if (!add.ok) return { error: `cabang kerja gagal dibuat: ${firstLine(add.err)}` }
  const nm = path.join(projectDir, 'node_modules')
  if (fs.existsSync(nm)) {
    try { fs.symlinkSync(nm, path.join(wt, info.rel, 'node_modules'), 'junction') } catch { /* tes dan build tak akan jalan, sisanya tetap */ }
  }
  return { cwd: path.join(wt, info.rel), worktree: wt, branch, base }
}

// Menyimpan hasil kerja sebagai satu commit di cabang task (node_modules tidak ikut). { sha, empty } atau { error }.
export async function snapshot({ worktree, title, taskId }) {
  if (!fs.existsSync(worktree)) return { error: 'folder kerja sudah tidak ada' }
  // dua pola: nama folder (tautannya) dan isinya; satu pola saja tidak mengecualikan isi folder
  const add = await git(worktree, ['add', '-A', '--', '.', ':(glob,exclude)**/node_modules', ':(glob,exclude)**/node_modules/**'])
  if (!add.ok) return { error: `gagal menyimpan perubahan: ${firstLine(add.err)}` }
  const changed = await git(worktree, ['diff', '--cached', '--quiet'])
  if (changed.ok) {
    const h = await git(worktree, ['rev-parse', 'HEAD'])
    return { empty: true, sha: h.out.trim() }
  }
  const msg = `kantor: ${String(title).replace(/\s+/g, ' ').slice(0, 72)}\n\nDari task #${taskId} papan Kantor Virtual.`
  let c = await git(worktree, ['commit', '-q', '--no-verify', '-m', msg])
  if (!c.ok && /ident|who you are|user\.(name|email)/i.test(c.err)) c = await git(worktree, [...IDENT, 'commit', '-q', '--no-verify', '-m', msg])
  if (!c.ok) return { error: `commit gagal: ${firstLine(c.err)}` }
  const h = await git(worktree, ['rev-parse', 'HEAD'])
  return { sha: h.out.trim() }
}

// Perubahan cabang task terhadap titik awalnya: daftar berkas dan patch (dipotong bila terlalu besar).
export async function diffOf({ worktree, base }) {
  if (!worktree || !base || !fs.existsSync(worktree)) return { error: 'cabang kerja sudah tidak ada' }
  const flags = ['-c', 'core.quotepath=off', 'diff', '--no-color', '--no-ext-diff', '--no-textconv']
  const stat = await git(worktree, [...flags, '--numstat', base, 'HEAD'])
  if (!stat.ok) return { error: firstLine(stat.err) }
  const files = stat.out.split('\n').filter(Boolean).map((l) => {
    const [a, r, ...p] = l.split('\t')
    return { path: p.join('\t'), added: a === '-' ? null : Number(a), removed: r === '-' ? null : Number(r) }
  })
  const patch = await git(worktree, [...flags, base, 'HEAD'])
  const text = patch.out ?? ''
  return { files, patch: text.slice(0, MAX_PATCH), truncated: text.length > MAX_PATCH }
}

// Menggabungkan cabang task ke cabang yang sedang aktif di proyek. Menolak bila ada perubahan belum di-commit,
// dan membatalkan penggabungan bila konflik, supaya proyek tidak tertinggal setengah jalan.
export async function mergeBranch({ projectDir, branch, title }) {
  const dirty = await git(projectDir, ['status', '--porcelain', '--untracked-files=no'])
  if (!dirty.ok) return { error: firstLine(dirty.err) }
  if (dirty.out.trim()) return { error: 'proyek punya perubahan yang belum di-commit, commit atau simpan dulu' }
  const cur = (await git(projectDir, ['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim()
  if (!cur || cur === 'HEAD') return { error: 'proyek sedang tidak di sebuah cabang, pindah ke cabang tujuan dulu' }
  const msg = `Gabungkan ${branch}: ${String(title).replace(/\s+/g, ' ').slice(0, 60)}`
  let m = await git(projectDir, ['merge', '--no-ff', '--no-edit', '-m', msg, branch])
  if (!m.ok && /ident|who you are|user\.(name|email)/i.test(m.err)) m = await git(projectDir, [...IDENT, 'merge', '--no-ff', '--no-edit', '-m', msg, branch])
  if (!m.ok) {
    await git(projectDir, ['merge', '--abort'])
    return { error: `penggabungan dibatalkan (${firstLine(m.err)}). Gabungkan manual: git merge ${branch}` }
  }
  return { ok: true, into: cur }
}

// Membuang worktree dan cabang task. Melepas junction node_modules lebih dulu, dan berhenti bila ada tautan tersisa.
export async function discard({ projectDir, worktree, branch }) {
  const info = await repoInfo(projectDir)
  if (!info) return { ok: true }
  if (worktree && fs.existsSync(worktree)) {
    if (!unlinkNodeModules(worktree, info.rel) || findLinks(worktree).length) {
      return { error: 'tautan node_modules di cabang kerja tidak bisa dilepas, hapus folder itu manual' }
    }
    const rm = await git(info.top, ['worktree', 'remove', '--force', worktree])
    if (!rm.ok && fs.existsSync(worktree)) {
      if (findLinks(worktree).length) return { error: 'cabang kerja masih berisi tautan, tidak dihapus' }
      try { fs.rmSync(worktree, { recursive: true, force: true }) } catch { return { error: `folder kerja tidak bisa dihapus: ${firstLine(rm.err)}` } }
    }
  }
  await git(info.top, ['worktree', 'prune'])
  if (branch) await git(info.top, ['branch', '-D', branch])
  return { ok: true }
}
