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

out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/proyek/README.md' } }] } })
out({ type: 'user', session_id: sid, message: { content: [{ type: 'tool_result', content: 'ISI-RAHASIA-FILE' }] } })
out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'curl -H "Authorization: Bearer RAHASIA" x' } }] } })
out({ type: 'assistant', session_id: sid, message: { content: [{ type: 'text', text: 'Hasil: ' + prompt }] } })
out({
  type: 'result', subtype: 'success', is_error: false, session_id: sid, num_turns: 2, duration_ms: 1234,
  result: `Hasil: ${prompt} | cwd=${process.cwd()} | args=${JSON.stringify(argv.slice(2))}`,
  permission_denials: prompt.includes('tolak') ? [{ tool_name: 'Bash' }] : [],
})
