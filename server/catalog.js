// Mengambil satu agent dari katalog aitmpl.com (repo davila7/claude-code-templates, lisensi MIT) ke kit ini.
// Ini satu-satunya panggilan keluar server, dan hanya terjadi saat pemilik komputer memintanya dari panel.
// Alamatnya tetap (raw.githubusercontent.com); dari klien hanya datang "kategori/nama" yang bentuknya diperiksa.
//
// Isi agent adalah teks pihak ketiga yang nanti menjadi instruksi subagent. Karena itu:
// - panel menampilkan seluruh isinya dulu, dan yang disimpan harus persis yang ditampilkan (dicocokkan lewat hash),
// - berkas yang disimpan DITULIS ULANG dari bagian yang dikenal saja (name, description, tools, model, isi).
//   Kunci frontmatter lain (hooks, permissionMode, mcpServers, dan sejenisnya) tidak pernah ikut tersimpan,
//   karena Claude Code membaca folder .claude/agents sendiri dan bisa menurutinya,
// - berkas yang sudah ada tidak pernah ditimpa.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseAgent } from './kit.js'

const REF_OK = /^[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}$/
const TOOL_OK = /^[A-Za-z][\w()*:,. /-]{0,80}$/
const BASE = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/agents'
const MAX_BYTES = 64 * 1024

// Berkas agent yang ditulis ulang dari bagian yang dikenal. Deskripsi satu baris berkutip, dibaca kembali oleh parseAgent.
export function serializeAgent(name, def) {
  const tools = (def.tools ?? []).filter((t) => TOOL_OK.test(t))
  const quoted = def.description.replace(/\\/g, '/').replace(/\r?\n/g, '\\n').replace(/"/g, '\\"')
  return [
    '---',
    `name: ${name}`,
    `description: "${quoted}"`,
    ...(tools.length ? [`tools: ${tools.join(', ')}`] : []),
    ...(def.model ? [`model: ${def.model}`] : []),
    '---',
    '',
    def.prompt,
    '',
  ].join('\n')
}

// { name, def, hash } atau { error }. hash: sidik isi yang diambil, untuk memastikan yang disimpan sama dengan yang dilihat.
export async function fetchAgent(ref, fetcher = fetch) {
  if (typeof ref !== 'string' || !REF_OK.test(ref)) return { error: 'tulis sebagai kategori/nama, misalnya development-team/frontend-developer' }
  let text
  try {
    const r = await fetcher(`${BASE}/${ref}.md`, { redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (r.status === 404) return { error: 'agent itu tidak ada di katalog' }
    if (!r.ok) return { error: `katalog menjawab ${r.status}` }
    if (Number(r.headers?.get?.('content-length')) > MAX_BYTES) return { error: 'berkas agent terlalu besar' }
    text = await r.text()
  } catch {
    return { error: 'katalog tidak terjangkau' }
  }
  if (text.length > MAX_BYTES) return { error: 'berkas agent terlalu besar' }
  const a = parseAgent(text)
  if (!a) return { error: 'berkas itu bukan agent yang sahih (butuh name, description, dan isi)' }
  return { ...a, hash: crypto.createHash('sha256').update(text).digest('hex') }
}

// Menyimpan agent ke folder kit, ditulis ulang dari bagian yang dikenal. Nama berkas dari nama agent yang sudah diperiksa bentuknya.
export function saveAgent(dir, name, def) {
  try {
    fs.writeFileSync(path.join(dir, `${name}.md`), serializeAgent(name, def), { flag: 'wx' })
    return { ok: true }
  } catch (e) {
    return { error: e.code === 'EEXIST' ? 'peran dengan nama itu sudah ada di kit' : 'berkas agent gagal disimpan' }
  }
}
