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

// Memecah "---\nkunci: nilai\n---\nisi". Hanya kunci satu baris yang dikenal kit ini.
function parseAgent(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return null
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const k = /^([a-zA-Z-]+):\s*(.*)$/.exec(line)
    if (k) meta[k[1]] = k[2].trim().replace(/^["']|["']$/g, '')
  }
  const prompt = m[2].trim()
  if (!NAME_OK.test(meta.name ?? '') || !meta.description || !prompt) return null
  const tools = (meta.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  return { name: meta.name, def: { description: meta.description, prompt, ...(tools.length && { tools }) } }
}

// { nama: { description, prompt, tools? } } dari semua berkas .md yang sahih di folder
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

// Menulis definisi ke folder sementara dengan nama dari isinya; isi yang sama memakai berkas yang sama.
export function writeAgentsFile(agents, dir = os.tmpdir()) {
  const json = JSON.stringify(agents)
  const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 12)
  const file = path.join(dir, `kantor-agents-${hash}.json`)
  if (!fs.existsSync(file)) fs.writeFileSync(file, json)
  return file
}

// Instruksi tambahan untuk sesi utama. Subagent yang hanya membaca boleh paralel; yang mengubah file harus
// berurutan supaya tidak saling menimpa. Bentuk perintah shell disebut persis karena subagent yang menambahkan
// "cd ..." atau opsi akan ditolak oleh daftar izin.
export function orchestrationPrompt(agents) {
  const names = Object.keys(agents)
  const writers = names.filter((n) => (agents[n].tools ?? []).some((t) => WRITE_TOOLS.has(t)))
  const readers = names.filter((n) => !writers.includes(n))
  const list = (a) => (a.length ? a.join(', ') : 'tidak ada')
  return [
    'Kamu bekerja untuk papan tugas kantor virtual. Direktori kerja sudah folder proyek.',
    'Pecah tugas menjadi bagian, lalu serahkan tiap bagian ke subagent yang cocok.',
    `Subagent yang hanya membaca (${list(readers)}) boleh dipanggil bersamaan dalam satu giliran.`,
    `Subagent yang mengubah file (${list(writers)}) dipanggil satu per satu: tunggu selesai sebelum memanggil berikutnya, supaya tidak saling menimpa file.`,
    "Perintah shell hanya 'npm test' dan 'npm run build', ditulis persis begitu: tanpa cd, tanpa opsi tambahan, tanpa menggabung perintah. Bila ditolak, jangan mencoba cara lain, cukup laporkan.",
    'Saat memanggil subagent, jangan menulis path folder di instruksinya.',
    'Akhiri dengan ringkasan singkat: apa yang dikerjakan, apa yang gagal, dan saran berikutnya.',
  ].join('\n')
}
