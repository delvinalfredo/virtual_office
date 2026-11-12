// Token semua sesi Claude Code di komputer ini hari ini (bukan hanya sesi dari aplikasi ini), dihitung dari
// transkrip di ~/.claude/projects. Hanya angka `usage` yang dibaca; isi percakapan tidak disimpan.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const CHUNK = 4 * 1024 * 1024
const tokensOf = (u) => ['input_tokens', 'cache_creation_input_tokens', 'output_tokens'].reduce((n, k) => n + (u?.[k] > 0 && Number.isFinite(u[k]) ? u[k] : 0), 0)
const startOfToday = () => new Date().setHours(0, 0, 0, 0)

async function* jsonlFiles(dir) {
  let list
  try { list = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of list) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* jsonlFiles(p)
    else if (e.name.endsWith('.jsonl')) yield p
  }
}

// today() mengembalikan hasil terakhir (null sebelum pemindaian pertama selesai) dan memindai ulang di latar bila
// hasilnya lebih tua dari maxAgeMs. Transkrip hanya bertambah di belakang, jadi tiap berkas dibaca dari posisi terakhir.
export function createMachineTokens({ dir = path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects'), maxAgeMs = 30000 } = {}) {
  const files = new Map() // berkas → { offset, rows: Map(kunci → { ts, n }) }
  let total = null
  let at = 0
  let running = null

  async function readNew(file, state) {
    const fh = await fs.open(file, 'r')
    try {
      const { size } = await fh.stat()
      if (size < state.offset) { state.offset = 0; state.rows.clear() } // berkas ditulis ulang
      let pos = state.offset
      let carry = Buffer.alloc(0)
      while (pos < size) {
        const buf = Buffer.alloc(Math.min(CHUNK, size - pos))
        const { bytesRead } = await fh.read(buf, 0, buf.length, pos)
        if (!bytesRead) break
        pos += bytesRead
        const data = Buffer.concat([carry, buf.subarray(0, bytesRead)])
        const cut = data.lastIndexOf(0x0a)
        if (cut < 0) { carry = data; continue }
        carry = data.subarray(cut + 1)
        for (const line of data.subarray(0, cut).toString('utf8').split('\n')) {
          if (!line.includes('"usage"')) continue
          try {
            const m = JSON.parse(line)
            const ts = Date.parse(m.timestamp)
            if (m.type !== 'assistant' || !m.message?.usage || !Number.isFinite(ts)) continue
            // satu pesan ditulis beberapa kali (tiap blok isinya); yang terakhir memuat jumlah output akhir
            state.rows.set(`${m.message.id ?? m.uuid}:${m.requestId ?? ''}`, { ts, n: tokensOf(m.message.usage) })
          } catch { /* baris rusak atau terpotong */ }
        }
        await new Promise((r) => setImmediate(r)) // beri jalan ke loop simulasi di antara potongan
      }
      state.offset = pos - carry.length // baris yang belum selesai ditulis dibaca lagi lain kali
    } finally {
      await fh.close()
    }
  }

  async function scan() {
    const start = startOfToday()
    const seen = new Set()
    for await (const file of jsonlFiles(dir)) {
      try {
        if ((await fs.stat(file)).mtimeMs < start) continue
        seen.add(file)
        if (!files.has(file)) files.set(file, { offset: 0, rows: new Map() })
        await readNew(file, files.get(file))
      } catch { /* berkas hilang atau terkunci: lewati */ }
    }
    for (const f of files.keys()) if (!seen.has(f)) files.delete(f)
    // pesan yang sama bisa ada di dua berkas (sesi yang dilanjutkan), jadi dihitung sekali per kunci
    const once = new Map()
    for (const { rows } of files.values()) for (const [k, r] of rows) if (r.ts >= start) once.set(k, r.n)
    total = [...once.values()].reduce((a, b) => a + b, 0)
    at = Date.now()
  }

  return {
    today() {
      if (!running && Date.now() - at > maxAgeMs) running = scan().catch(() => {}).finally(() => { running = null; at ||= Date.now() })
      return total
    },
    // untuk uji: tunggu pemindaian yang sedang jalan
    settled: async () => { await running },
  }
}
