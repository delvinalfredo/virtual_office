# Virtual Kantor — Sistem Task per Agent

Ide: setiap agent (programmer, designer, QA, dst.) itu worker. Kamu (atau sistem)
memberi task, task punya status, status menentukan apa yang kelihatan di kantor 3D.

## Alur data

```
TaskQueue (daftar task)
   │  dispatch: task paling depan → agent yang idle
   ▼
Agent.state = idle | walking | working
   │
   ├─ idle     → avatar berdiri di pojok / meja sendiri
   ├─ walking  → avatar jalan (lerp posisi) ke meja tasknya
   └─ working  → avatar di meja, animasi ketik, layar monitor menyala
                 progress bar naik → selesai → task pindah ke "done"
   ▼
Board (papan status kanan kantor):
   [ To Do ]   [ In Progress ]   [ Done ]
   - task A    - task C @BOB     - task B ✓
```

Contoh mapping status → visual:

| Task status   | Avatar                                | Meja/monitor          | Board          |
|---------------|----------------------------------------|-----------------------|----------------|
| todo          | duduk santai di meja masing-masing     | layar mati            | kolom To Do    |
| in_progress   | jalan ke meja, animasi ketik           | layar menyala         | kolom In Progress |
| review        | jalan ke ruang meeting, duduk          | whiteboard tulisan    | kolom Review   |
| done          | kembali ke meja, layar mati            | —                     | kolom Done ✓   |

## Struktur file yang cocok

```
src/
  tasks.js        # task store + reducer: addTask, assignTask, tick progress
  agents.js       # daftar agent: id, role, idlePos, deskPos, speed
  useTaskLoop.js  # interval kecil: dispatch → jalan → kerja → selesai
  Office.jsx      # + meja per agent (pakai deskPos), Board komponen
  Avatar.jsx      # terima properti state (idle/walk/work) → animasi
  App.jsx         # panel input task, debug: tombol "tambah task"
```

## Contoh data

```js
// agents.js
export const AGENTS = [
  { id: 'prog1', role: 'programmer', desk: [-4, 4.4], skill: 1.0 },
  { id: 'prog2', role: 'programmer', desk: [ 4, 4.4], skill: 1.2 },
  { id: 'designer', role: 'designer', desk: [-4, 1.4], skill: 0.8 },
]

// tasks.js — task baru masuk kolom To Do
{ id: 1, title: 'Bikin halaman login', type: 'programming', est: 6, status: 'todo', agent: null }
```

## Multiplayer/online nanti

- Simpan task list di satu sumber (SQLite/Postgres/Supabase).
- Browser subscribe via websocket; avatar pemain lain posisinya di-broadcast ~10×/detik.
- Task selesai → server broadcast → semua browser update avatar + board sekaligus.

## Default dulu, upgrade belakangan

- v1: single-player simulasi lokal, agent otomatis picking task.
- v2: task bisa kamu add dari UI panel.
- v3: sync ke server, jadi dashboard benar-benar multi user.
```
