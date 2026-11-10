// Pengganti `claude` untuk uji: meniru bentuk keluaran stream-json tanpa memakai akun atau jatah apa pun.
// Dipanggil seperti claude: node fake-claude.mjs -p "<tugas>" --output-format stream-json ...
// Kata kunci dalam tugas mengatur perilaku: "error" (gagal), "lama" (menggantung), "tolak" (ada izin ditolak).
const argv = process.argv.slice(2)
const prompt = argv[1] ?? ''
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
const sid = 'fake-sess-1'

out({ type: 'system', subtype: 'init', session_id: sid, model: 'fake' })
if (prompt.includes('error')) {
  process.stderr.write('boom: contoh galat\n')
  process.exit(1)
}
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
out({
  type: 'result', subtype: 'success', is_error: false, session_id: sid, num_turns: 2, duration_ms: 1234,
  result: `Hasil: ${prompt} | cwd=${process.cwd()} | args=${JSON.stringify(argv.slice(2))}`,
  permission_denials: prompt.includes('tolak') ? [{ tool_name: 'Bash' }] : [],
})
