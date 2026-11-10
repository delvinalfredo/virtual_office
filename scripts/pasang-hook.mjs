// Memasang (atau mencabut) hook Claude Code yang mengirim event subagent ke kantor virtual.
//
//   node scripts/pasang-hook.mjs            pasang di ~/.claude/settings.json (semua proyek)
//   node scripts/pasang-hook.mjs --hapus    cabut lagi
//   node scripts/pasang-hook.mjs --status   cek hook dan server tanpa mengubah apa pun
//   node scripts/pasang-hook.mjs --port 3100   bila server kantor tidak di port 3000
//
// Yang dilakukan: baca file pengaturan, simpan cadangan (settings.json.bak-kantor, sekali saja),
// tambahkan tiga hook HTTP ke 127.0.0.1, tulis kembali. Isi lain tidak disentuh, dan menjalankannya
// dua kali tidak menggandakan hook. Env CLAUDE_SETTINGS mengganti lokasi file (dipakai untuk uji).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const remove = args.includes('--hapus')
const port = Number(args[args.indexOf('--port') + 1]) || 3000
const file = process.env.CLAUDE_SETTINGS ?? path.join(os.homedir(), '.claude', 'settings.json')
const url = `http://127.0.0.1:${port}/api/events`
const EVENTS = ['SubagentStart', 'SubagentStop', 'PreToolUse']
// semua port kantor dianggap milik kita saat mencabut, supaya --hapus tetap bersih setelah ganti port
const ours = (h) => h?.type === 'http' && /^http:\/\/127\.0\.0\.1:\d+\/api\/events$/.test(h.url ?? '')

// --status: hanya melapor (hook terpasang? server kantor hidup?), tidak mengubah apa pun
if (args.includes('--status')) {
  let s = {}
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* file belum ada atau rusak: dianggap belum terpasang */ }
  const have = EVENTS.filter((ev) => (s.hooks?.[ev] ?? []).some((g) => (g.hooks ?? []).some(ours)))
  console.log(`Hook di ${file}: ${have.length === EVENTS.length ? 'terpasang' : have.length ? 'sebagian (' + have.join(', ') + ')' : 'belum terpasang'}`)
  const up = await fetch(`http://127.0.0.1:${port}/api/agents`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false)
  console.log(`Server kantor di port ${port}: ${up ? 'hidup' : 'tidak menjawab (jalankan npm start di folder virtual_office)'}`)
  process.exit(0)
}

let settings = {}
if (fs.existsSync(file)) {
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`File pengaturan bukan JSON yang valid, tidak diubah: ${file}\n${e.message}`)
    process.exit(1)
  }
  const bak = `${file}.bak-kantor`
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak)
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

settings.hooks ??= {}
let changed = 0
for (const ev of EVENTS) {
  const groups = settings.hooks[ev] ?? []
  // buang dulu hook kantor yang lama (port bisa berbeda), lalu pasang yang baru bila tidak --hapus
  const kept = groups
    .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) }))
    .filter((g) => g.hooks.length > 0)
  if (kept.length !== groups.length || groups.some((g, i) => (g.hooks ?? []).length !== (kept[i]?.hooks ?? []).length)) changed++
  if (!remove) {
    kept.push({ hooks: [{ type: 'http', url, timeout: 2 }] })
    changed++
  }
  if (kept.length) settings.hooks[ev] = kept
  else delete settings.hooks[ev]
}
if (!Object.keys(settings.hooks).length) delete settings.hooks

fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n')
console.log(remove ? `Hook kantor dicabut dari ${file}` : `Hook kantor terpasang di ${file} (menuju ${url})`)
console.log(changed ? 'Buka /hooks di Claude Code atau mulai sesi baru supaya terbaca.' : 'Tidak ada yang berubah.')
