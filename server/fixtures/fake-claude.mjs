// Pengganti `claude` untuk uji: meniru bentuk keluaran stream-json tanpa memakai akun atau jatah apa pun.
// Dipanggil seperti claude: node fake-claude.mjs -p "<tugas>" --output-format stream-json ...
// Kata kunci dalam tugas mengatur perilaku: "error" (gagal), "lama" (menggantung), "tolak" (ada izin ditolak).
import fs from 'node:fs'
const argv = process.argv.slice(2)
const prompt = argv[1] ?? ''
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const sid = 'fake-sess-1'

out({ type: 'system', subtype: 'init', session_id: sid, model: 'fake' })
if (prompt.includes('error')) {
  process.stderr.write('boom: contoh galat\n')
  process.exit(1)
}
// kata "tulis": mengubah berkas di folder kerja, seperti Claude yang mengedit proyek
if (/(^|\s)tulis(\s|$)/.test(prompt)) fs.writeFileSync(`hasil-${prompt.replace(/\W+/g, '-').slice(0, 30)}.txt`, `${prompt}
`)
// "buatrencana <json>": perencana pekerjaan besar, menulis rencana mesin dan rencana untuk dibaca tim
if (prompt.startsWith('buatrencana ')) {
  fs.writeFileSync('kantor-plan.json', prompt.slice('buatrencana '.length))
  fs.mkdirSync('docs/plans', { recursive: true })
  fs.writeFileSync('docs/plans/rencana.md', '# rencana\n')
}
// "berkas=<nama> isi=<kata>": menulis satu berkas dengan isi tertentu
const tulis = /berkas=(\S+) isi=(\S+)/.exec(prompt)
if (tulis && !prompt.includes('penanda konflik') && !prompt.includes('hasilnya gagal')) fs.writeFileSync(tulis[1], `${tulis[2]}\n`)
// instruksi perbaikan dari server: merapikan penanda konflik, atau membuang penyebab tes gagal
if (prompt.includes('penanda konflik')) {
  for (const f of fs.readdirSync('.')) {
    if (!fs.statSync(f).isFile()) continue
    const isi = fs.readFileSync(f, 'utf8')
    // isi yang memuat "keras" sengaja tidak dirapikan: meniru sesi yang gagal membereskan bentrokan
    if (/^<{7} /m.test(isi) && !isi.includes('keras')) fs.writeFileSync(f, isi.split('\n').filter((l) => !/^(<{7} |={7}$|>{7} )/.test(l.trimEnd())).join('\n'))
  }
}
if (prompt.includes('hasilnya gagal') && fs.existsSync('rusak.txt') && !fs.readFileSync('rusak.txt', 'utf8').includes('bandel')) fs.rmSync('rusak.txt')
if (prompt.includes('lama')) await new Promise((r) => setTimeout(r, 60000))

if (prompt.includes('subagen')) {
  const ev = (subtype, id, extra) => out({ type: 'system', subtype, session_id: sid, tool_use_id: id, subagent_type: id === 'tu-a' ? 'planner' : 'tdd-guide', ...extra })
  ev('task_started', 'tu-a', { description: 'RAHASIA: isi instruksi bebas' })
  ev('task_started', 'tu-b', { description: 'tulis tes' })
  ev('task_progress', 'tu-a', { last_tool_name: 'Read', description: 'Reading /rahasia/kunci.txt' })
  ev('task_notification', 'tu-a', { status: 'completed' })
  ev('task_progress', 'tu-a', { last_tool_name: 'Grep' }) // sesudah selesai: diabaikan
  if (prompt.includes('hasilsaja')) {
    // tanpa task_notification: selesai hanya terlihat dari hasil panggilan Agent
    out({ type: 'user', session_id: sid, message: { content: [{ type: 'tool_result', tool_use_id: 'tu-b', content: 'ok' }] } })
  } else if (!prompt.includes('menggantung')) ev('task_notification', 'tu-b', { status: 'failed' })
}
out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/proyek/README.md' } }] } })
out({ type: 'user', session_id: sid, message: { content: [{ type: 'tool_result', content: 'ISI-RAHASIA-FILE' }] } })
out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'curl -H "Authorization: Bearer RAHASIA" x' } }] } })
out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'text', text: 'Hasil: ' + prompt }] } })
out({ type: 'rate_limit_event', session_id: sid, rate_limit_info: { status: 'allowed', unifiedWindows: { five_hour: { utilization: 0.25, resetsAt: 1900000000, status: 'allowed' }, seven_day: { utilization: 0.5, resetsAt: 1900100000, status: 'allowed' } } } })
out({
  type: 'result', subtype: 'success', is_error: false, session_id: sid, num_turns: 2, duration_ms: 1234,
  result: `Hasil: ${prompt} | cwd=${process.cwd()} | args=${JSON.stringify(argv.slice(2))}`,
  permission_denials: prompt.includes('tolak') ? [{ tool_name: 'Bash' }] : [],
  total_cost_usd: 0.25,
  usage: { input_tokens: 10, cache_creation_input_tokens: 200, cache_read_input_tokens: 5000, output_tokens: 40 },
})
