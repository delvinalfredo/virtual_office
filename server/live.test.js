import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHook, describeTool } from './live.js'

test('SubagentStart dan SubagentStop menjadi start dan stop', () => {
  const start = parseHook({ hook_event_name: 'SubagentStart', agent_id: 'a1b2', agent_type: 'code-reviewer' })
  assert.deepEqual(start, { kind: 'start', id: 'a1b2', type: 'code-reviewer' })
  assert.deepEqual(parseHook({ hook_event_name: 'SubagentStop', agent_id: 'a1b2', last_assistant_message: 'rahasia' }), { kind: 'stop', id: 'a1b2' })
})

test('event tanpa agent_id atau dengan bentuk aneh diabaikan', () => {
  assert.equal(parseHook({ hook_event_name: 'SubagentStart', agent_type: 'x' }), null)
  assert.equal(parseHook({ hook_event_name: 'Stop' }), null)
  assert.equal(parseHook(null), null)
  assert.equal(parseHook('teks'), null)
})

test('tool di dalam subagent: hanya nama file dan kata pertama perintah yang tampil', () => {
  const edit = parseHook({ hook_event_name: 'PreToolUse', agent_id: 'a1', agent_type: 'planner', tool_name: 'Edit', tool_input: { file_path: 'D:\\proyek\\rahasia\\kunci.env', new_string: 'TOKEN=abc123' } })
  assert.equal(edit.text, 'Mengedit kunci.env')
  const bash = describeTool('Bash', { command: 'curl -H "Authorization: Bearer abc123" https://x.test' })
  assert.equal(bash, 'Menjalankan curl')
  assert.ok(!bash.includes('abc123'))
})

test('PreToolUse tanpa agent_id pada tool Agent menjadi deskripsi untuk subagent berikutnya', () => {
  const ask = parseHook({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'architect', description: 'Rancang modul <login>', prompt: 'isi panjang' } })
  assert.deepEqual(ask, { kind: 'ask', type: 'architect', text: 'Rancang modul login' })
  assert.equal(parseHook({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a.js' } }), null)
})

test('nilai bukan teks dan teks sangat panjang tidak merusak hasil', () => {
  assert.equal(describeTool('Read', { file_path: 42 }), 'Membaca')
  assert.ok(describeTool('Edit', { file_path: 'x'.repeat(500) + '.js' }).length <= 'Mengedit '.length + 40)
  assert.equal(parseHook({ hook_event_name: 'SubagentStart', agent_id: 'i'.repeat(200), agent_type: 't'.repeat(200) }).id.length, 64)
})
