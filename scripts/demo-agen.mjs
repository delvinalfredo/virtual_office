// Mengirim event tiruan ke server kantor supaya kamu bisa melihat tamu agen tanpa Claude Code.
//   node scripts/demo-agen.mjs          (port 3000; node scripts/demo-agen.mjs 3100 untuk port lain)
// Tiga agen masuk, bekerja beberapa detik dengan tool berbeda, lalu selesai dan pulang.
const port = Number(process.argv[2]) || 3000
const send = (b) =>
  fetch(`http://127.0.0.1:${port}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const crew = [
  ['demo1', 'architect', [['Read', { file_path: 'docs/PROJECT.md' }], ['Grep', {}], ['Edit', { file_path: 'src/App.jsx' }]]],
  ['demo2', 'code-reviewer', [['Read', { file_path: 'server/index.js' }], ['Bash', { command: 'npm test' }]]],
  ['demo3', 'security-reviewer', [['Grep', {}], ['Read', { file_path: 'server/live.js' }], ['WebSearch', {}]]],
]
try {
  for (const [id, type] of crew) await send({ hook_event_name: 'SubagentStart', agent_id: id, agent_type: type })
} catch {
  console.error(`Server kantor tidak menjawab di port ${port}. Jalankan dulu: npm start`)
  process.exit(1)
}
console.log('Tiga agen masuk. Lihat di browser kantor. Mereka berjalan ke ruang meeting dulu, sekitar 6 detik.')
await sleep(7000)
for (let i = 0; i < 3; i++) {
  for (const [id, type, tools] of crew) {
    const [name, input] = tools[i % tools.length]
    await send({ hook_event_name: 'PreToolUse', agent_id: id, agent_type: type, tool_name: name, tool_input: input })
  }
  await sleep(2500)
}
for (const [id, type] of crew) await send({ hook_event_name: 'SubagentStop', agent_id: id, agent_type: type })
console.log('Selesai. Mereka berkonfeti lalu pulang.')
