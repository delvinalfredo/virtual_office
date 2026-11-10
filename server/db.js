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
export const getTasks = () =>
  db.prepare('SELECT * FROM tasks ORDER BY id DESC').all()

// antrian: yang paling lama menunggu duluan (getTasks sengaja DESC untuk tampilan board)
export const getTasksByStatus = (status) =>
  db.prepare('SELECT * FROM tasks WHERE status=? ORDER BY id ASC').all(status)

// state agent hanya di memori, jadi sesudah restart task in_progress tidak ada yang mengerjakan.
// review milik lead balik ke antrian review, sisanya balik ke todo.
export const recoverStuckTasks = () => {
  const review = db.prepare(
    "UPDATE tasks SET status='review', progress=est WHERE status='in_progress' AND agent_id='lead'"
  ).run().changes
  const todo = db.prepare(
    "UPDATE tasks SET status='todo', agent_id=NULL, progress=0 WHERE status='in_progress'"
  ).run().changes
  return { review, todo }
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

export default db
