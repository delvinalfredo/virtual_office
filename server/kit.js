// Subagent kit (.claude/agents/*.md) untuk sesi Claude Code yang dijalankan dari papan Kanban.
// Kit tinggal di repo ini, jadi folder proyek target tidak perlu memilikinya: definisinya diberikan lewat
// `--agents <berkas>`. Berkas dipakai karena badan semua agent bersama bisa melewati batas panjang
// baris perintah Windows.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const NAME_OK = /^[a-z0-9-]{1,40}$/
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const MODELS = new Set(['haiku', 'sonnet', 'opus', 'fable', 'inherit'])
// Model bawaan per peran: yang mahal hanya untuk merancang dan review keamanan, yang murah untuk merapikan dokumen.
// Baris `model:` di berkas agent menang atas tabel ini; peran di luar tabel ikut model sesi.
export const ROLE_MODEL = {
  architect: 'opus', planner: 'opus', 'security-reviewer': 'opus',
  'code-reviewer': 'sonnet', 'tdd-guide': 'sonnet', 'build-error-resolver': 'sonnet', 'refactor-cleaner': 'sonnet', 'e2e-runner': 'sonnet',
  'context-sync': 'haiku',
}

// Memecah "---\nkunci: nilai\n---\nisi". Kunci satu baris, ditambah nilai blok YAML ("|" atau ">") yang
// dipakai sebagian agent dari luar untuk deskripsi panjang.
export function parseAgent(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const meta = {}
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const k = /^([a-zA-Z-]+):\s*(.*)$/.exec(lines[i])
    if (!k) continue
    let value = k[2].trim()
    if (/^[|>][+-]?$/.test(value)) {
      const block = []
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || !lines[i + 1].trim())) block.push(lines[++i].trim())
      value = block.join(' ').trim()
    }
    // nilai berkutip ganda dari agent luar memakai \n dan \" tertulis; dikembalikan ke bentuk aslinya
    meta[k[1]] = value.startsWith('"') ? value.replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"') : value.replace(/^'|'$/g, '')
  }
  const prompt = m[2].trim()
  if (!NAME_OK.test(meta.name ?? '') || !meta.description || !prompt) return null
  const tools = (meta.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  const model = MODELS.has(meta.model) ? meta.model : ROLE_MODEL[meta.name]
  return { name: meta.name, def: { description: meta.description, prompt, ...(tools.length && { tools }), ...(model && model !== 'inherit' && { model }) } }
}

// { nama: { description, prompt, tools?, model? } } dari semua berkas .md yang sahih di folder
export function loadKitAgents(dir) {
  let files
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() } catch { return {} }
  const out = {}
  for (const f of files) {
    let text
    try { text = fs.readFileSync(path.join(dir, f), 'utf8') } catch { continue }
    const a = parseAgent(text)
    if (a && !out[a.name]) out[a.name] = a.def
  }
  return out
}

export const writesFiles = (def) => (def.tools ?? []).some((t) => WRITE_TOOLS.has(t))

// Menulis definisi ke folder sementara dengan nama dari isinya; isi yang sama memakai berkas yang sama.
export function writeAgentsFile(agents, dir = os.tmpdir()) {
  const json = JSON.stringify(agents)
  const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 12)
  const file = path.join(dir, `kantor-agents-${hash}.json`)
  if (!fs.existsSync(file)) fs.writeFileSync(file, json)
  return file
}

// Perintah shell yang diizinkan proyek, dibaca dari daftar izinnya: "Bash(npm test)" menjadi "npm test".
export const shellOf = (allowedTools = []) => allowedTools.map((t) => /^Bash\((.+)\)$/.exec(t)?.[1]).filter(Boolean)

// Instruksi tambahan untuk sesi utama. Subagent yang hanya membaca boleh paralel; yang mengubah file harus
// berurutan supaya tidak saling menimpa. Bentuk perintah shell disebut persis karena subagent yang menambahkan
// "cd ..." atau opsi akan ditolak oleh daftar izin.
export function orchestrationPrompt(agents, shell = ['npm test', 'npm run build']) {
  const names = Object.keys(agents)
  const writers = names.filter((n) => writesFiles(agents[n]))
  const readers = names.filter((n) => !writers.includes(n))
  const list = (a) => (a.length ? a.join(', ') : 'tidak ada')
  const exact = shell.filter((c) => !c.includes('*'))
  const open = shell.filter((c) => c.includes('*'))
  return [
    'Kamu bekerja untuk papan tugas kantor virtual. Direktori kerja sudah folder proyek.',
    ...(names.length ? [
      'Pecah tugas menjadi bagian, lalu serahkan tiap bagian ke subagent yang cocok. Tugas kecil dikerjakan langsung tanpa subagent.',
      `Subagent yang hanya membaca (${list(readers)}) boleh dipanggil bersamaan dalam satu giliran.`,
      `Subagent yang mengubah file (${list(writers)}) dipanggil satu per satu: tunggu selesai sebelum memanggil berikutnya, supaya tidak saling menimpa file.`,
    ] : ['Kerjakan tugas ini langsung, tanpa memanggil subagent.']),
    shell.length
      ? `Perintah shell hanya ini${exact.length ? `, ditulis persis: ${exact.map((c) => `'${c}'`).join(', ')}` : ''}${open.length ? `; dan yang berawalan: ${open.map((c) => `'${c.replace(/\s*\*$/, '')}'`).join(', ')}` : ''}. Tanpa cd, tanpa menggabung perintah. Bila ditolak, jangan mencoba cara lain, cukup laporkan.`
      : 'Perintah shell tidak diizinkan di proyek ini. Jangan mencoba menjalankannya, cukup laporkan apa yang perlu dijalankan.',
    'Git tidak perlu disentuh: server menyimpan hasil kerjamu sebagai commit, dan menjalankan tes serta build sendiri setelah kamu selesai.',
    'Saat memanggil subagent, jangan menulis path folder di instruksinya.',
    'Akhiri dengan ringkasan singkat: apa yang dikerjakan, apa yang gagal, dan saran berikutnya.',
  ].join('\n')
}

// Bagian kit yang ikut ke proyek lain: subagent, perintah, aturan, skill, templat PROJECT.md, dan CLAUDE.md.
const KIT_PARTS = ['.claude/agents', '.claude/commands', '.claude/rules', '.claude/skills', '.claude/PROJECT.template.md', 'CLAUDE.md', 'docs/specs/README.md', 'docs/audits/README.md']

// Menyalin berkas yang belum ada di tujuan; mengembalikan jumlah berkas yang disalin.
function copyMissing(from, to) {
  const st = fs.statSync(from)
  if (st.isDirectory()) {
    let n = 0
    for (const name of fs.readdirSync(from)) n += copyMissing(path.join(from, name), path.join(to, name))
    return n
  }
  if (!st.isFile()) return 0
  // lstat: tautan di tujuan (termasuk yang putus) dianggap sudah ada, supaya salinan tidak pernah mengikuti tautan keluar proyek
  try { fs.lstatSync(to); return 0 } catch { /* belum ada: disalin */ }
  fs.mkdirSync(path.dirname(to), { recursive: true })
  try { fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL) } catch (e) { if (e.code === 'EEXIST') return 0; throw e }
  return 1
}

// Menyalin kit ke folder proyek. Berkas yang sudah ada di proyek tidak pernah ditimpa. { copied } atau { error }.
export function installKit(kitRoot, dir) {
  let copied = 0
  try {
    for (const part of KIT_PARTS) {
      const from = path.join(kitRoot, part)
      if (fs.existsSync(from)) copied += copyMissing(from, path.join(dir, part))
    }
  } catch (e) {
    return { error: `kit gagal disalin: ${String(e.message).split('\n')[0]}` }
  }
  return { copied }
}
