import fs from 'node:fs'
import path from 'node:path'

// Hanya folder yang didaftarkan di sini yang boleh dipakai sesi. Folder lain tidak bisa dipilih dari dashboard.
// Izin awal sengaja sempit: membaca dan mengedit file. Perintah shell tidak diizinkan kecuali ditambahkan
// lewat "allowedTools" per proyek.
export const DEFAULT_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write']
const TOOL_OK = /^[\w(),:* ./-]+$/

export function loadProjects(file) {
  let raw
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
  if (!Array.isArray(raw)) return []
  const out = []
  for (const p of raw) {
    const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 40) : ''
    const dir = typeof p?.path === 'string' && p.path.trim() ? path.resolve(p.path) : ''
    if (!name || !dir) continue
    try { if (!fs.statSync(dir).isDirectory()) continue } catch { continue }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `p${out.length + 1}`
    if (out.some((o) => o.id === id)) continue
    const tools = Array.isArray(p.allowedTools) ? p.allowedTools.filter((t) => typeof t === 'string' && TOOL_OK.test(t)).slice(0, 20) : []
    out.push({ id, name, path: dir, allowedTools: tools.length ? tools : DEFAULT_TOOLS })
  }
  return out
}
