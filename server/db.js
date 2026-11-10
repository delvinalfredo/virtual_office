import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// KANTOR_DB=:memory: dipakai test supaya tidak menyentuh kantor.db asli
const db = new Database(process.env.KANTOR_DB ?? path.join(__dirname, 'kantor.db'))
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  desk_x REAL NOT NULL,
  desk_z REAL NOT NULL,
  skill REAL NOT NULL DEFAULT 1.0
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',   -- todo | in_progress | review | done
  agent_id TEXT REFERENCES agents(id),
  est REAL NOT NULL DEFAULT 5,           -- detik kerja pada skill 1.0
  progress REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  output TEXT
);
`)

// Kolom untuk task yang dikerjakan Claude Code. Database lama ditambah kolomnya saat server mulai.
//   mode: 'sim' (agent simulasi) atau 'claude'; prompt, detail, session_id, project_id hanya dilihat pemilik komputer
const have = new Set(db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name))
for (const [name, def] of [['mode', "TEXT NOT NULL DEFAULT 'sim'"], ['project_id', 'TEXT'], ['session_id', 'TEXT'], ['prompt', 'TEXT'], ['detail', 'TEXT'], ['roles', 'TEXT']]) {
  if (!have.has(name)) db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${def}`)
}

// Riwayat setiap sesi Claude (task maupun manual): dasar biaya dan daftar riwayat di panel. Hanya untuk pemilik komputer.
db.exec(`
CREATE TABLE IF NOT EXISTS session_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  project TEXT NOT NULL,
  state TEXT NOT NULL,
  runs INTEGER NOT NULL DEFAULT 1,
  tools INTEGER NOT NULL DEFAULT 0,
  denials INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  seconds REAL,
  subagents TEXT,
  result TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL
);
`)
const KEEP_LOG = 200

// seed agents hanya sekali (tabel agents awalnya kosong)
const n = db.prepare('SELECT COUNT(*) c FROM agents').get().c
if (n === 0) {
  const ins = db.prepare('INSERT INTO agents (id, role, desk_x, desk_z, skill) VALUES (?,?,?,?,?)')
  ins.run('prog1', 'programmer', -4, 5.0, 1.0)
  ins.run('prog2', 'programmer', 4, 5.0, 1.2)
  ins.run('designer', 'designer', -4, 0.0, 0.8)
  ins.run('qa', 'qa', 4, 0.0, 0.9)
  ins.run('lead', 'lead', 0, 2.5, 1.5)
}

export const getAgents = () => db.prepare('SELECT * FROM agents').all()
// cost: jumlah biaya semua sesi task itu (0 untuk task simulasi)
export const getTasks = () =>
  db.prepare('SELECT t.*, (SELECT COALESCE(SUM(cost), 0) FROM session_log WHERE task_id = t.id) AS cost FROM tasks t ORDER BY t.id DESC').all()

// antrian: yang paling lama menunggu duluan (getTasks sengaja DESC untuk tampilan board)
export const getTasksByStatus = (status) =>
  db.prepare('SELECT * FROM tasks WHERE status=? ORDER BY id ASC').all(status)

// state agent hanya di memori, jadi sesudah restart task in_progress tidak ada yang mengerjakan.
// review milik lead balik ke antrian review, sisanya balik ke todo.
// Task Claude yang sedang jalan tidak diulang otomatis (menghabiskan token): masuk review dengan catatan.
// Semua sesi hilang saat restart, jadi id sesi di task Claude dikosongkan (id sesi dipakai ulang mulai dari s1).
export const RESTART_NOTE = 'Sesi terputus karena server dimulai ulang. Pilih Ulangi untuk menjalankan lagi.'
export const recoverStuckTasks = () => {
  const claude = db.prepare(
    "UPDATE tasks SET status='review', output=? WHERE status='in_progress' AND mode='claude'"
  ).run(RESTART_NOTE).changes
  db.prepare("UPDATE tasks SET session_id=NULL WHERE mode='claude'").run()
  const review = db.prepare(
    "UPDATE tasks SET status='review', progress=est WHERE status='in_progress' AND agent_id='lead' AND mode='sim'"
  ).run().changes
  const todo = db.prepare(
    "UPDATE tasks SET status='todo', agent_id=NULL, progress=0 WHERE status='in_progress' AND mode='sim'"
  ).run().changes
  return { review, todo, claude }
}

export const getTask = (id) => db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
// hanya task yang sedang jalan yang dicari lewat sesi, supaya id sesi lama tidak salah sasaran
export const getRunningTaskBySession = (sid) =>
  db.prepare("SELECT * FROM tasks WHERE session_id=? AND status='in_progress' AND mode='claude'").get(sid)
// roles: nama subagent yang boleh dipakai (null: semua subagent kit)
export const insertClaudeTask = (title, projectId, prompt, roles = null) =>
  db.prepare("INSERT INTO tasks (title, mode, project_id, prompt, roles) VALUES (?, 'claude', ?, ?, ?)")
    .run(title, projectId, prompt, roles ? JSON.stringify(roles) : null)
// tampilan untuk semua pemain di jaringan: tanpa instruksi, hasil, proyek, peran, biaya, dan id sesi milik pemilik
export const publicTask = (t) => {
  const { prompt: _prompt, detail: _detail, session_id: _session, project_id: _project, roles: _roles, cost: _cost, ...rest } = t
  return rest
}

export const insertTask = (title, est) =>
  db.prepare('INSERT INTO tasks (title, est) VALUES (?,?)').run(title, est)

export const updateTask = (id, fields) => {
  const keys = Object.keys(fields)
  db.prepare(
    `UPDATE tasks SET ${keys.map((k) => `${k}=?`).join(', ')} WHERE id=?`
  ).run(...keys.map((k) => fields[k]), id)
}

export const numTasks = {
  byStatus: (status) => db.prepare('SELECT COUNT(*) c FROM tasks WHERE status=?').get(status).c,
}

export const logSession = (r) => {
  db.prepare(`INSERT INTO session_log (task_id, project, state, runs, tools, denials, cost, seconds, subagents, result, error, started_at, ended_at)
              VALUES (@task_id, @project, @state, @runs, @tools, @denials, @cost, @seconds, @subagents, @result, @error, @started_at, @ended_at)`).run(r)
  db.prepare('DELETE FROM session_log WHERE id <= (SELECT MAX(id) FROM session_log) - ?').run(KEEP_LOG)
}
export const getHistory = (limit = 50) => db.prepare('SELECT * FROM session_log ORDER BY id DESC LIMIT ?').all(limit)
// biaya sesi hari ini (menurut jam komputer) dan seluruh riwayat yang tersimpan
export const costSummary = () => db.prepare(`
  SELECT COALESCE(SUM(CASE WHEN date(ended_at, 'localtime') = date('now', 'localtime') THEN cost END), 0) AS today,
         COALESCE(SUM(cost), 0) AS total, COUNT(*) AS runs
  FROM session_log`).get()

export default db
