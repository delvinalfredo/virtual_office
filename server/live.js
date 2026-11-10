// Menerjemahkan payload hook Claude Code menjadi aksi untuk kantor.
// Payload memuat banyak hal (isi file, perintah shell, hasil tool). Dari situ hanya diambil nama
// tool, nama file tanpa folder, dan kata pertama perintah, semuanya dipendekkan dan dibersihkan.
// Isi file dan teks perintah lengkap tidak pernah disimpan atau ditampilkan.

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[^\w .:/-]/g, '').trim().slice(0, max) : '')
const baseName = (p) => (typeof p === 'string' ? clean(p.split(/[\\/]/).pop(), 40) : '')

export function describeTool(name, input) {
  const i = input && typeof input === 'object' ? input : {}
  switch (name) {
    case 'Read':
      return `Membaca ${baseName(i.file_path)}`.trim()
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `Mengedit ${baseName(i.file_path ?? i.notebook_path)}`.trim()
    case 'Bash':
      return `Menjalankan ${baseName(typeof i.command === 'string' ? i.command.trim().split(/\s+/)[0] : '')}`.trim()
    case 'Grep':
    case 'Glob':
      return 'Mencari di kode'
    case 'WebFetch':
    case 'WebSearch':
      return 'Mencari di web'
    case 'Agent':
    case 'Task':
      return 'Memanggil agen lain'
    default:
      return `Memakai ${clean(name, 24) || 'tool'}`
  }
}

// Kembalikan { kind, id?, type?, text? } atau null bila event tidak relevan.
//   start / stop : subagent mulai atau selesai
//   tool         : subagent memakai tool (bubble berubah)
//   ask          : sesi utama memanggil subagent; deskripsinya dipakai untuk subagent berikutnya bertipe sama
export function parseHook(b) {
  if (!b || typeof b !== 'object') return null
  const ev = b.hook_event_name
  const id = clean(b.agent_id, 64)
  const type = clean(b.agent_type, 32)
  if (ev === 'SubagentStart') return id && type ? { kind: 'start', id, type } : null
  if (ev === 'SubagentStop') return id ? { kind: 'stop', id } : null
  if (ev === 'PreToolUse') {
    if (id) return { kind: 'tool', id, type, text: describeTool(b.tool_name, b.tool_input) }
    if (b.tool_name === 'Agent' || b.tool_name === 'Task') {
      const i = b.tool_input && typeof b.tool_input === 'object' ? b.tool_input : {}
      return { kind: 'ask', type: clean(i.subagent_type, 32) || 'general-purpose', text: clean(i.description, 80) }
    }
  }
  return null
}
