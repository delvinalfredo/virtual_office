# Project Context

Living snapshot of the project's verified state. Replace stale facts; never append history.

_Last verified: 2026-11-10_

## Verified Stack

| Field | Value |
| --- | --- |
| Runtime/language | Node.js 22.22.2, JavaScript (ESM, `"type": "module"`), no TypeScript |
| Framework | Backend: Express 5.3.0 + ws 8.22.1 (`server/index.js`); Frontend: React 19.3.1 + Vite 8.3.6 |
| Package manager | npm 10.9.7 (`package-lock.json`) |
| Database | SQLite via better-sqlite3 12.11.1, file `server/kantor.db` (WAL mode, gitignored); schema created with `CREATE TABLE IF NOT EXISTS` in `server/db.js`, no migrations |
| Cache/queue | none |
| Frontend | React 19 + @react-three/fiber 9.8.2 + @react-three/drei 10.7.9 + three 0.187.0 (3D office scene), plain CSS with tokens in `src/index.css`, Nunito via `@fontsource-variable/nunito` (self-hosted), lint with oxlint |
| Build/test commands | `npm start` (backend, `node server/index.js`), `npm run dev` (Vite dev server, proxies `/ws` and `/api` to port 3000), `npm run build`, `npm run lint`, `npm test` (`node --test server/*.test.js`: antrian dan pemulihan task di SQLite memori, parser hook) |
| Deployment/container | none; in production Express serves `dist/` statically from the same process (`PORT` env, default 3000) |

## Application Flow

Two views of the same application. Per-feature detail belongs in `docs/specs/` and `docs/plans/`.

### User Flow

What a person does, start to end, one line per main journey (role in brackets). Only journeys the code actually implements.

- [pemain] buka halaman → dapat nama tersimpan di `localStorage` (atau acak `kamu-NNN`) → jalan dengan WASD/panah → posisi dan level (lantai atau rooftop) dikirim ke server → pemain lain melihat avatarnya: tiap kali pemain bergerak
- [pemain] kolom Nama di kiri bawah → ganti nama → server memberi suffix `-2` bila bentrok → nama baru tampil di peer lain dan di chat: saat kolom kehilangan fokus atau Enter
- [pemain] koneksi putus → banner "Koneksi ke server putus" → klien mencoba lagi dengan jeda 1s sampai 10s → snapshot baru memulihkan state: saat server restart atau jaringan putus
- [pemain] `TaskForm` (judul + estimasi detik) → task masuk kolom To Do di `Board` → agent idle (bukan lead) jalan ke mejanya dan mengerjakan → status `review` → agent `lead` jalan ke ruang meeting dan mereview → kolom Done dengan output teks: setiap task baru
- [pemain] `Board` → hapus task (hanya kolom To Do dan Done) → task hilang, agent yang sedang mengerjakan kembali idle: saat tombol hapus ditekan
- [pemain] `ChatUI` → kirim chat global → semua pemain melihatnya dan 30 pesan terakhir ikut ke pendatang baru → agent idle terdekat membalas dengan kalimat kaleng: tiap pesan
- [pemain] klik avatar agent → `AgentDM` → kirim DM → agent membalas kalimat kaleng sesuai role dan menampilkan bubble: tiap DM
- [pemain] `Minimap` → klik titik → pemain teleport ke posisi itu: saat minimap diklik
- [pengamat] sesi Claude Code berjalan → hook mengirim event subagent → karakter tamu bertipe subagent masuk lewat pintu, duduk di ruang meeting, bubble mengikuti tool yang dipakai, berkonfeti saat selesai lalu pulang: tiap subagent mulai dan berhenti (hanya bila hook terpasang)
- [pemain] centang "camera bebas (orbit)" → kamera lepas dari pemain (OrbitControls): saat checkbox diubah

### System Flow

Cross-module paths only: entry point → module → where state lands or which external system is called.

- Browser `src/useKantor.js` WebSocket `/ws` → `server/index.js` (`wss`) → pesan `snapshot` (termasuk riwayat chat) lalu `agents` / `peers` (tanpa diri sendiri) / `chat` / `task-update`: saat koneksi dibuka dan tiap perubahan state
- Browser `POST /api/tasks`, `DELETE /api/tasks/:id`, `GET /api/tasks|agents|stats` → `server/index.js` → `server/db.js` → SQLite `server/kantor.db` → broadcast `task-update` → klien fetch ulang `/api/tasks`: saat pemain menambah atau menghapus task
- `server/index.js` sim loop (`setInterval` 50 ms) + dispatcher (1 s) → `dispatch` / `dispatchReview` → `updateTask` di `server/db.js` → SQLite → broadcast `agents` dan `task-update`: terus-menerus selama server hidup
- `server/index.js` dan `src/Avatar.jsx` sama-sama mengimpor `src/office-plan.js` (`clampToRoom`, `resolveObstacles`, `WALL`) untuk collision: tiap tick gerakan agent di server dan pemain di klien
- Claude Code hook `SubagentStart` / `SubagentStop` / `PreToolUse` (HTTP) → `POST /api/events` (hanya dari loopback) → `server/live.js` (`parseHook`) → `liveStart` / `liveTool` / `liveStop` di `server/index.js` → agen `live-*` di Map yang sama dengan agen simulasi → broadcast `agents` → `src/AgentAvatars.jsx`: tiap event hook
- Dev: Vite (`vite.config.js`) proxy `/ws` dan `/api` → `localhost:3000`; Prod: Express `express.static('dist')`: setiap request halaman

### Flow Diagram

One mermaid flowchart mirroring the System Flow list: same paths, nothing internal.

```mermaid
flowchart LR
  B[Browser React + R3F] -- WS /ws --> S[server/index.js]
  B -- REST /api/tasks --> S
  S --> D[server/db.js]
  D --> Q[(SQLite server/kantor.db)]
  L[Sim loop 50ms + dispatch 1s] --> S
  S -- broadcast agents / peers / chat / task-update --> B
  P[src/office-plan.js] -.collision.-> S
  P -.collision.-> B
  V[Vite dev proxy] -. dev only .-> S
  H[Claude Code hooks] -- POST /api/events --> S
```

## Modules & Access

Only what the repository shows. `none` for a row the project does not have; never a guess.

- Modules: `server` in `server/` — Express + ws server, simulasi agent, dispatcher task, REST API, SQLite access (`db.js`), penerjemah payload hook (`live.js`)
- Modules: `scene` in `src/` — `Office.jsx`, `Rooftop.jsx`, `SkyDeco.jsx` (awan), `Humanoid.jsx` (karakter chibi), `props.jsx` (`Box` dan `Ink` bergaris tepi untuk perabot), `Avatar.jsx` (Player), `AgentAvatars.jsx`, `PeerAvatars.jsx`, `ChatBubble.jsx`, `Burst.jsx` (konfeti), `toon.js` (bahan toon dan outline bersama), `looks.js` (tampilan tiap karakter), `motion.js` (peredam gerak), `theme3d.js` (warna 3D), `office-plan.js` (denah dan collision, dipakai server juga)
- Modules: `ui` in `src/` — `Board.jsx` (kanban + `TaskForm`), `ChatUI.jsx`, `AgentDM.jsx`, `Minimap.jsx`, `sfx.js`; gayanya di `src/index.css`
- Modules: `state` in `src/` — `useKantor.js` (WS + REST client), `useKeyboard.js`
- Authentication: none; nama pemain acak dari klien, server hanya memotong 24 karakter dan menambah suffix bila bentrok
- Roles: none untuk pengguna; agent simulasi punya role `programmer`, `designer`, `qa`, `lead` (seed di `server/db.js`), hanya `lead` yang mereview
- Approval chain: none untuk pengguna; di simulasi, task worker selesai → status `review` → agent `lead` mengubahnya ke `done`

## Environments & Jobs

- Environments: local saja; satu database `server/kantor.db` di sebelah server; env yang dibaca: `PORT` (default 3000), `KANTOR_DB` (path database, `:memory:` dipakai test), `LIVE_LINGER_MS` (lama tamu agen berdiam setelah selesai, default 4000); tidak ada `.env.example`
- Scheduled jobs and workers: in-process `setInterval` di `server/index.js`: sim loop tiap 50 ms (gerak agent, progress task), `dispatch` + `dispatchReview` tiap 1 detik; saat start, `recoverStuckTasks` mengembalikan task `in_progress` ke `todo` (review lead ke `review`); tidak ada cron atau worker terpisah

## Architecture Notes

Module boundaries and who owns what.

- Server adalah sumber kebenaran untuk posisi agent, task, dan daftar peer; klien hanya merender dan mengirim input (posisi pemain, chat, task baru).
- State runtime agent (posisi, state, bubble) hidup di memori server (`Map`) dan hilang saat restart; hanya tabel `agents` dan `tasks` yang persisten.
- Tabel `agents` di-seed sekali saat kosong (5 agent dengan posisi meja); mengubah posisi meja berarti mengubah baris DB atau menghapus `kantor.db`.
- Klien tidak menerima isi task lewat WS; `task-update` hanya sinyal, lalu klien fetch `/api/tasks`.
- Antrian task FIFO: `getTasksByStatus` (id naik) dipakai dispatcher, sedangkan `getTasks` (id turun) hanya untuk tampilan board.
- Server menghitung daftar peer per penerima tanpa entri penerima itu sendiri; klien tidak boleh menyaring nama sendiri. Nama unik diputuskan server dari nama yang diminta klien.
- Level pemain (0 lantai, 1 rooftop) ikut di pesan `player-pos` dan `peers`; `src/PeerAvatars.jsx` menaikkan avatar ke y 3.18 untuk level 1.
- Koneksi WS wajib punya listener `error` (ada di `server/index.js`); tanpa itu satu frame rusak mematikan proses.
- Agent yang selesai jalan santai kembali idle lewat blok idle di sim loop (`idleWalk`); jangan mengubahnya jadi `working` saat tiba, karena agent tanpa task tidak akan dipilih dispatcher. Titik meja menempel di tepi kotak tabrakan meja, jadi "sudah sampai" memakai `ARRIVE` (0,35), bukan 0,05.
- Agent berjalan lurus dengan `resolveObstacles`, tanpa pencarian rute. Bila nyaris tidak bergerak selama 1,5 detik, ia berbelok lewat lorong tengah (`a.via`, x = 0); setelah 10 detik berjalan ia dipindah ke targetnya. Tanpa ini agent tertahan tegak lurus di tepi meja dan task-nya diam. Ganti dengan A* bila denah di `src/office-plan.js` berubah.
- Teks bubble `Disetujui` (konstanta `APPROVED` di `server/index.js`) juga dibaca `src/AgentAvatars.jsx` sebagai pemicu konfeti; ubah keduanya bersama.
- Tamu agen nyata (`live: true`) memakai loop gerak yang sama dengan agen simulasi tetapi tanpa task di database: dispatcher, balasan chat, dan perilaku idle melewati mereka. Maksimal 12 sekaligus; id dari `agent_id` hook; tampilan dari `agent_type` (tipe sama, tampilan sama; label diberi nomor bila kembar). Kursi hanya di titik yang terjangkau jalan lurus dari pintu (`SEATS`), karena agen tidak punya pencarian rute.
- `SubagentStart` tidak membawa deskripsi tugas; deskripsi diambil dari `PreToolUse` tool `Agent` di sesi utama dan dipasangkan menurut tipe subagent (antrian, kedaluwarsa 2 menit). Dari payload hook hanya nama tool, nama file tanpa folder, dan kata pertama perintah yang dipakai; isi file, perintah lengkap, dan hasil subagent tidak disimpan atau dikirim ke klien.
- Gerak karakter dihitung dari jarak yang ditempuh grup induknya (`Humanoid.jsx`), bukan dari prop. Semua penghalusan memakai `damp` dan `dampAngle` di `src/motion.js` supaya sama di semua frame rate. Pemain lain dikirim tiap 100 ms.
- Label nama dan bubble adalah DOM lewat `Html` milik drei. Label di `Humanoid.jsx` dipasang satu tick setelah render pertama, karena yang dipasang saat render awal Canvas (hanya Player) tidak muncul di DOM.
- Warna UI hanya lewat token di `:root` di `src/index.css`; warna adegan 3D yang sama ada di `src/theme3d.js` dan `src/looks.js`. Karakter agent orisinal per role, bukan tokoh berhak cipta.
- `src/office-plan.js` dibagi server dan klien lewat import relatif (`../src/office-plan.js`); jangan menaruh kode browser-only di file itu.
- `TASKS.md` adalah catatan ide awal, bukan spesifikasi; struktur file di dalamnya tidak sesuai dengan kode sekarang.

## Important Integrations

External systems this project talks to, and where the client lives.

- Claude Code hooks (hanya masuk, HTTP ke `POST /api/events`): sumber agen nyata di kantor. Tidak ada panggilan keluar ke Claude atau API lain, dan server tidak memegang kredensial apa pun.

## Conventions

Project rules an agent must follow that the code does not make obvious.

- Data classification: `standard` (data hanya task fiktif, agent simulasi, nama pemain acak; tidak ada data nasabah atau pribadi)
- Bahasa komentar kode, pesan UI, dan pesan commit: Bahasa Indonesia santai.
- Validasi input ada di server (`title` wajib string ≤ 80, `est` 1..600, chat ≤ 120, posisi harus angka finite); pertahankan saat menambah endpoint atau pesan WS.
- `.gitignore` sudah mengecualikan `server/kantor.db*` dan `workspace/`; jangan commit file database.

## Known Constraints

Operational limits, deliberate tradeoffs, and things that must not be "fixed".

- Tidak ada autentikasi; pembatasan hanya pesan WS maksimal 4 KB dan satu chat atau DM per 500 ms per koneksi. REST tidak dibatasi. Aplikasi dimaksudkan untuk jaringan lokal atau demo, bukan internet publik.
- Vite dev diikat ke `127.0.0.1` di `vite.config.js`. Bawaannya (`localhost` jatuh ke IPv6) membuat Chrome di mesin pengembangan menampilkan halaman putih atau "connection was reset". Akses dari jaringan: `npm run dev -- --host`.
- Hook Claude Code harus dipasang sendiri di `.claude/settings.json` (contoh di `README.md`); URL-nya memakai port 3000. Endpoint `/api/events` menolak selain loopback dan selalu menjawab 200 untuk payload rusak supaya hook tidak mencatat kegagalan.
- Riwayat chat (30 pesan) hanya di memori server dan hilang saat restart.
- Rata-rata waktu di "Report tim" dihitung dari task dibuat sampai selesai, jadi ikut menghitung waktu antre.
- Warna perabot di `Office.jsx` dan `Rooftop.jsx` masih literal di JSX (belum lewat token). Lantai kayu dan kaca masih memakai bahan standar tanpa garis tepi.
- Peringatan lint lama masih ada di `Office.jsx` (fungsi `Window` dan variabel `shade` tidak terpakai) dan `Rooftop.jsx` (parameter `d`).
- Satu proses server, state di memori: tidak bisa di-scale horizontal tanpa memindahkan state agent dan peer keluar proses.
- Balasan chat dan DM agent adalah kalimat kaleng acak, bukan LLM; `output` task juga teks hasil generate acak.
- `updateTask` membangun SQL dari nama kolom yang dikirim pemanggil; hanya boleh dipanggil dengan kunci yang hardcoded di server, jangan pernah meneruskan field dari request body.
- Test mencakup antrian dan pemulihan task (`server/db.test.js`) dan parser hook (`server/live.test.js`); WebSocket, simulasi agent, dan UI belum punya test. `npm run lint` (oxlint) masih mengeluarkan peringatan lama.

> Do not store secrets, tokens, passwords, or private credentials here.
