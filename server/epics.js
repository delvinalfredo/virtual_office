// Pekerjaan besar: satu permintaan dipecah sesi perencana menjadi beberapa task Claude yang punya urutan
// ketergantungan dan pembagian berkas. Berkas ini hanya memuat bagian yang bisa diuji tanpa server: instruksi
// perencana, pemeriksaan rencana, dan instruksi tiap task. Alurnya (cabang, sesi, penggabungan) ada di index.js.
import fs from 'node:fs'
import path from 'node:path'

export const PLAN_FILE = 'kantor-plan.json'
export const MAX_TASKS = 12
export const MAX_EPIC_PROMPT = 3000
const TASK_PROMPT_MAX = 2500
const KEY_OK = /^[a-z0-9-]{1,24}$/
// perencana hanya membaca proyek dan menulis rencananya
export const PLAN_TOOLS = ['Read', 'Grep', 'Glob', 'Write']

export const epicBranch = (id) => `kantor/epic-${id}`
export const planDoc = (id) => `docs/plans/epic-${id}.md`

// Instruksi sistem untuk sesi perencana. Permintaan pemilik masuk sebagai tugas sesi (-p), bukan di sini.
export function plannerPrompt(epicId, roles) {
  return [
    'Kamu perencana tim di kantor virtual. Tugasmu HANYA merencanakan: jangan menulis kode aplikasi dan jangan memanggil subagent.',
    'Baca proyek secukupnya (docs/PROJECT.md bila ada, struktur folder, berkas yang relevan), lalu tulis dua berkas:',
    `1. ${planDoc(epicId)}: rencana untuk dibaca tim. Ringkas: tujuan, keputusan teknis (stack, struktur folder, nama berkas, kontrak antar bagian seperti bentuk API dan nama fungsi), lalu satu bagian per task dengan judul "## <key>". Task lain akan membaca berkas ini, jadi semua yang harus disepakati bersama ditulis di sini, bukan diulang di tiap task.`,
    `2. ${PLAN_FILE} di folder kerja: rencana untuk mesin, JSON murni dengan bentuk`,
    '   {"tasks":[{"key":"api-auth","title":"judul pendek","prompt":"apa yang dikerjakan dan kapan dianggap selesai","deps":["key-lain"],"files":["src/a.js","src/b/"],"roles":["tdd-guide"]}]}',
    'Aturan rencana:',
    `- Paling banyak ${MAX_TASKS} task. Jangan memecah lebih kecil dari yang perlu: task yang terlalu kecil memboroskan token karena tiap task adalah sesi baru yang membaca proyek dari awal.`,
    '- key: huruf kecil, angka, tanda hubung. deps hanya menunjuk key yang ditulis lebih dulu di daftar.',
    '- Task tanpa deps berjalan bersamaan, jadi dua task yang berjalan bersamaan TIDAK BOLEH menyentuh berkas yang sama. Bila dua task perlu berkas yang sama, beri deps supaya berurutan.',
    '- Task pertama untuk proyek kosong adalah kerangka (package.json, struktur folder, skrip test dan build), dan semua task lain bergantung padanya.',
    '- files: berkas atau folder yang menjadi tanggung jawab task itu.',
    `- roles: subagent yang boleh dipakai task itu, dari daftar ini: ${roles.join(', ') || '(tidak ada)'}. Kosongkan (tanpa kunci roles) bila task cukup dikerjakan langsung; itu paling hemat.`,
    '- Tiap task harus bisa diperiksa dengan tes dan build proyek.',
    'Akhiri dengan ringkasan dua kalimat. Jangan mengerjakan task-nya.',
  ].join('\n')
}

// Memeriksa rencana dari perencana. { tasks } yang sudah dirapikan, atau { error }.
export function parsePlan(text, roleNames) {
  let raw
  try { raw = JSON.parse(text) } catch { return { error: 'rencana bukan JSON yang sahih' } }
  const list = Array.isArray(raw?.tasks) ? raw.tasks : null
  if (!list || !list.length) return { error: 'rencana tidak memuat task' }
  if (list.length > MAX_TASKS) return { error: `rencana memuat ${list.length} task, maksimal ${MAX_TASKS}` }
  const seen = new Set()
  const tasks = []
  for (const t of list) {
    const key = typeof t?.key === 'string' ? t.key.trim() : ''
    if (!KEY_OK.test(key) || seen.has(key)) return { error: `key task tidak sahih atau kembar: ${String(t?.key).slice(0, 30)}` }
    const title = typeof t.title === 'string' ? t.title.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    const prompt = typeof t.prompt === 'string' ? t.prompt.trim().slice(0, TASK_PROMPT_MAX) : ''
    if (!title || !prompt) return { error: `task ${key} tidak punya judul atau instruksi` }
    const deps = Array.isArray(t.deps) ? [...new Set(t.deps)] : []
    // deps hanya boleh menunjuk task yang sudah lewat: dengan begitu rencana pasti tidak melingkar
    if (deps.some((d) => !seen.has(d))) return { error: `task ${key} bergantung pada task yang belum ada di atasnya` }
    const files = Array.isArray(t.files) ? t.files.filter((f) => typeof f === 'string' && f.trim() && !f.includes('..') && !path.isAbsolute(f)).map((f) => f.trim().slice(0, 80)).slice(0, 10) : []
    // peran yang tidak dikenal dibuang, bukan menggagalkan rencana; daftar kosong berarti tanpa subagent
    const roles = Array.isArray(t.roles) ? [...new Set(t.roles.filter((r) => roleNames.includes(r)))] : []
    seen.add(key)
    tasks.push({ key, title, prompt, deps, files, roles })
  }
  return { tasks }
}

// Membaca lalu menghapus berkas rencana mesin dari folder kerja, supaya tidak ikut masuk commit.
export function takePlan(cwd, roleNames) {
  const file = path.join(cwd, PLAN_FILE)
  let text
  try {
    if (fs.statSync(file).size > 256 * 1024) return { error: 'berkas rencana terlalu besar' }
    text = fs.readFileSync(file, 'utf8')
  } catch { return { error: `perencana tidak menulis ${PLAN_FILE}` } }
  try { fs.unlinkSync(file) } catch { /* tidak terhapus: tetap dipakai */ }
  return parsePlan(text, roleNames)
}

// Instruksi sesi untuk satu task pekerjaan besar: menunjuk rencana bersama, bukan mengulang isinya.
export function taskPrompt(epicId, t) {
  return [
    `Kamu mengerjakan satu bagian dari pekerjaan besar. Baca ${planDoc(epicId)} dulu, terutama bagian "${t.key}" dan keputusan teknisnya. Ikuti kontrak yang tertulis di sana.`,
    `Bagianmu (${t.key}): ${t.prompt}`,
    t.files.length ? `Berkas tanggung jawabmu: ${t.files.join(', ')}. Jangan mengubah berkas di luar itu kecuali memang tidak bisa dihindari, dan sebutkan bila terjadi.` : '',
    'Kerjakan hanya bagian ini. Bagian lain dikerjakan anggota tim lain di cabang mereka.',
  ].filter(Boolean).join('\n\n')
}

// Task yang boleh mulai: semua yang ditunggunya sudah selesai.
export function ready(task, all) {
  let deps
  try { deps = JSON.parse(task.deps ?? '[]') } catch { deps = [] }
  return deps.every((id) => all.find((t) => t.id === id)?.status === 'done')
}
