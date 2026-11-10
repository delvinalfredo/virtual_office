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
| Build/test commands | `npm start` (backend, `node server/index.js`), `npm run dev` (Vite dev server, proxies `/api` to port 3000; WebSocket langsung ke port 3000, tanpa proxy), `npm run build`, `npm run lint`, `npm test` (`node --test server/*.test.js`: antrian dan pemulihan task di SQLite memori, parser hook) |
| Deployment/container | none; in production Express serves `dist/` statically from the same process (`PORT` env, default 3000) |

## Application Flow

Two views of the same application. Per-feature detail belongs in `docs/specs/` and `docs/plans/`.

### User Flow

What a person does, start to end, one line per main journey (role in brackets). Only journeys the code actually implements.

- [pemain] buka halaman → dapat nama tersimpan di `localStorage` (atau acak `kamu-NNN`) → jalan dengan WASD/panah → posisi dikirim ke server → pemain lain melihat avatarnya: tiap kali pemain bergerak
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
- [pengguna lokal] `Sessions` (tombol Sesi Claude) → pilih proyek terdaftar + tugas → `POST /api/sessions` (loopback, token, Host dan Origin lokal) → `server/sessions.js` menjalankan `claude -p` di folder proyek → keluaran stream-json → kartu sesi dan karakter berlabel nama proyek di kantor → Lanjutkan (`--resume`) atau Hentikan: tiap tugas
- [pengguna lokal] `TaskForm` (Dikerjakan oleh: Claude Code + proyek + instruksi) → `POST /api/tasks/claude` → task `todo` bermode `claude` → `dispatchClaude` (tiap detik) membuka sesi lewat mesin sesi dengan subagent kit, instruksi orkestrasi, dan batas biaya → kartu di `In Progress` menampilkan aktivitas dan subagent yang berjalan, karakter tamu per subagent di kantor → sesi selesai, gagal, atau dihentikan → kolom `Review` → pemilik memilih Setujui (`done`), Revisi (`--resume` dengan catatan), atau Ulangi (kembali ke `todo`, sesi baru): tiap task Claude
- Dev: Vite (`vite.config.js`) proxy `/api` → `localhost:3000`, sedangkan `useKantor.js` membuka WebSocket langsung ke `ws://<hostname>:3000/ws` (`import.meta.env.DEV`); Prod: Express `express.static('dist')`: setiap request halaman

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
  V[Vite dev proxy /api] -. dev only .-> S
  H[Claude Code hooks] -- POST /api/events --> S
```

## Modules & Access

Only what the repository shows. `none` for a row the project does not have; never a guess.

- Modules: `server` in `server/` — Express + ws server, simulasi agent, dispatcher task, REST API, SQLite access (`db.js`), penerjemah payload hook (`live.js`), mesin sesi Claude Code (`sessions.js`), daftar proyek (`projects.js`), pembaca subagent kit dan instruksi orkestrasi (`kit.js`)
- Modules: `scene` in `src/` — `Office.jsx`, `SkyDeco.jsx` (awan), `Humanoid.jsx` (karakter chibi), `props.jsx` (`Box` dan `Ink` bergaris tepi untuk perabot), `Avatar.jsx` (Player), `AgentAvatars.jsx`, `PeerAvatars.jsx`, `ChatBubble.jsx`, `Burst.jsx` (konfeti), `toon.js` (bahan toon dan outline bersama), `looks.js` (tampilan tiap karakter), `motion.js` (peredam gerak), `theme3d.js` (warna 3D), `office-plan.js` (denah dan collision, dipakai server juga)
- Modules: `ui` in `src/` — `Board.jsx` (kanban + `TaskForm`), `ChatUI.jsx`, `AgentDM.jsx`, `Minimap.jsx`, `sfx.js`; gayanya di `src/index.css`
- Modules: `state` in `src/` — `useKantor.js` (WS + REST client), `interp.js` (interpolasi posisi karakter lain), `useKeyboard.js`
- Modules: `sessions` — `server/sessions.js` (proses `claude -p`), `server/control.js` (penjaga), `server/projects.js` (daftar folder), `src/Sessions.jsx` (panel)
- Authentication: none; nama pemain acak dari klien, server hanya memotong 24 karakter dan menambah suffix bila bentrok
- Roles: none untuk pengguna; agent simulasi punya role `programmer`, `designer`, `qa`, `lead` (seed di `server/db.js`), hanya `lead` yang mereview
- Approval chain: none untuk pengguna; di simulasi, task worker selesai → status `review` → agent `lead` mengubahnya ke `done`

## Environments & Jobs

- Environments: local saja; satu database `server/kantor.db` di sebelah server; env yang dibaca: `PORT` (default 3000), `KANTOR_DB` (path database, `:memory:` dipakai test), `LIVE_LINGER_MS` (lama tamu agen berdiam setelah selesai, default 4000), `KANTOR_PROJECTS` (path daftar proyek, default `server/projects.json`), `KANTOR_CLAUDE_BIN` (program claude, diganti Claude palsu saat uji), `KANTOR_MAX_BUDGET` (batas biaya dalam USD per task Claude, default 2); tidak ada `.env.example`
- Scheduled jobs and workers: in-process `setInterval` di `server/index.js`: sim loop tiap 50 ms (gerak agent, progress task), `dispatch` + `dispatchReview` tiap 1 detik; saat start, `recoverStuckTasks` mengembalikan task `in_progress` ke `todo` (review lead ke `review`); tidak ada cron atau worker terpisah

## Architecture Notes

Module boundaries and who owns what.

- Server adalah sumber kebenaran untuk posisi agent, task, dan daftar peer; klien hanya merender dan mengirim input (posisi pemain, chat, task baru).
- State runtime agent (posisi, state, bubble) hidup di memori server (`Map`) dan hilang saat restart; hanya tabel `agents` dan `tasks` yang persisten.
- Tabel `agents` di-seed sekali saat kosong (5 agent dengan posisi meja); mengubah posisi meja berarti mengubah baris DB atau menghapus `kantor.db`.
- Klien tidak menerima isi task lewat WS; `task-update` hanya sinyal, lalu klien fetch `/api/tasks`.
- Antrian task FIFO: `getTasksByStatus` (id naik) dipakai dispatcher, sedangkan `getTasks` (id turun) hanya untuk tampilan board.
- Server menghitung daftar peer per penerima tanpa entri penerima itu sendiri; klien tidak boleh menyaring nama sendiri. Nama unik diputuskan server dari nama yang diminta klien.
- Kantor hanya satu lantai: tidak ada rooftop, portal, atau level pemain di pesan `player-pos` dan `peers`.
- Koneksi WS wajib punya listener `error` (ada di `server/index.js`); tanpa itu satu frame rusak mematikan proses.
- Agent yang selesai jalan santai kembali idle lewat blok idle di sim loop (`idleWalk`); jangan mengubahnya jadi `working` saat tiba, karena agent tanpa task tidak akan dipilih dispatcher. Titik meja menempel di tepi kotak tabrakan meja, jadi "sudah sampai" memakai `ARRIVE` (0,35), bukan 0,05.
- Agent berjalan lurus dengan `resolveObstacles`, tanpa pencarian rute. Bila nyaris tidak bergerak selama 1,5 detik, ia berbelok lewat lorong tengah (`a.via`, x = 0); setelah 10 detik berjalan ia dipindah ke targetnya. Tanpa ini agent tertahan tegak lurus di tepi meja dan task-nya diam. Ganti dengan A* bila denah di `src/office-plan.js` berubah.
- Teks bubble `Disetujui` (konstanta `APPROVED` di `server/index.js`) juga dibaca `src/AgentAvatars.jsx` sebagai pemicu konfeti; ubah keduanya bersama.
- Tamu agen nyata (`live: true`) memakai loop gerak yang sama dengan agen simulasi tetapi tanpa task di database: dispatcher, balasan chat, dan perilaku idle melewati mereka. Maksimal 12 sekaligus; id dari `agent_id` hook; tampilan dari `agent_type` (tipe sama, tampilan sama; label diberi nomor bila kembar). Kursi hanya di titik yang terjangkau jalan lurus dari pintu (`SEATS`), karena agen tidak punya pencarian rute.
- `SubagentStart` tidak membawa deskripsi tugas; deskripsi diambil dari `PreToolUse` tool `Agent` di sesi utama dan dipasangkan menurut tipe subagent (antrian, kedaluwarsa 2 menit). Dari payload hook hanya nama tool, nama file tanpa folder, dan kata pertama perintah yang dipakai; isi file, perintah lengkap, dan hasil subagent tidak disimpan atau dikirim ke klien.
- Sesi Claude dari dashboard: hanya folder di `server/projects.json` (tidak masuk git; contoh di `projects.example.json`) yang bisa dipilih. Daftar itu bisa diubah dari panel (`Kelola proyek`) lewat `GET/POST /api/projects` dan `DELETE /api/projects/:id` di `server/index.js`, dengan penjaga yang sama dengan sesi (loopback, Host dan Origin lokal, token). Jalur folder memang dikirim klien saat menambah, jadi `addProject` di `server/projects.js` menolak yang bukan alamat lengkap, bukan folder, akar drive, atau kembar; proyek baru selalu memakai izin bawaan (izin khusus hanya lewat edit berkas), berkas rusak tidak ditimpa, entri yang foldernya sedang hilang tetap tersimpan, dan proyek dengan sesi berjalan tidak bisa dihapus. Daftar di memori diganti di tempat (`splice`) karena mesin sesi memegang array yang sama. Izin awal `acceptEdits` plus `--allowedTools` Read, Grep, Glob, Edit, Write; tool lain ditolak dan jumlahnya dilaporkan. Program dijalankan tanpa shell, tugas ditaruh tepat setelah `-p` (sebelum `--allowedTools` yang bisa menelannya), tanpa `--bare` karena itu melewati login. Maksimal 3 sesi berjalan, batas waktu 30 menit, tugas maksimal 4000 huruf dan tidak boleh diawali minus.
- Task Claude dari papan Kanban: kolom `tasks.mode` (`sim` atau `claude`), `project_id`, `session_id`, `prompt`, `detail` ditambahkan lewat migrasi saat server mulai. Dispatcher dan review lead simulasi melewati task `claude`. Sesi memakai `--agents <berkas>` yang dibuat dari `.claude/agents/*.md` repo ini (berkas, bukan argumen: JSON-nya sekitar 99 KB, di atas batas baris perintah Windows), `--append-system-prompt` (subagent yang hanya membaca boleh paralel, yang menulis berurutan, bentuk perintah shell disebut persis), dan `--max-budget-usd`. Subagent terbaca dari stream sesi (`task_started`, `task_progress`, `task_notification`, dan `tool_result` panggilan `Agent` sebagai penanda selesai cadangan) dan tampil sebagai karakter tamu; yang tak sempat melapor dihentikan saat sesi berakhir. Hanya jenis subagent dan nama tool yang dipakai untuk bubble, bukan deskripsi bebas dari model. Event hook dari sesi dashboard diabaikan (`ownsClaudeId`) agar karakter tidak dobel.
- Izin proyek: `DEFAULT_TOOLS` kini memuat `Agent`. Proyek yang dicentang "Izinkan tes dan build" (`checks` di `projects.json`, `PATCH /api/projects/:id`) mendapat tepat `Bash(npm test)` dan `Bash(npm run build)` (`CHECK_TOOLS`); form hanya mengirim centang. Subagent kadang menulis `cd ... && npm test` dan ditolak, jadi instruksi orkestrasi menyebut bentuk perintah persisnya, dan jumlah izin ditolak tampil di kartu.
- Privasi task Claude: `GET /api/tasks` mengembalikan `publicTask` (tanpa `prompt`, `detail`, `session_id`, `project_id`) kecuali permintaan lolos penjaga lokal (`isOwner`); membuat, memutuskan, dan menghapus task Claude hanya dari komputer ini. Restart server: task Claude yang berjalan masuk `Review` dengan catatan, tidak diulang otomatis, dan `session_id` semua task Claude dikosongkan karena id sesi dipakai ulang mulai dari `s1`.
- Posisi agent dan pemain lain tidak disimpan di state React. Server mengirim `ts` (jam simulasi yang naik 50 ms per tick untuk agent). Untuk pemain, yang dipakai `ct`: jam `performance.now()` browser pengirim saat posisi diambil, diteruskan server apa adanya; `ts` (waktu terima server) hanya cadangan bila `ct` tidak ada. Tiap pemain punya selisih jamnya sendiri di `interp.js`, dan jam yang mundur jauh dianggap muat ulang (riwayat dimulai lagi). `useKantor.js` memasukkannya ke `src/interp.js`, dan karakter membaca posisi terinterpolasi per frame (tertinggal 120 ms untuk agent, 220 ms untuk pemain). State React hanya berubah bila status, bubble, atau daftar karakter berubah. Tanpa `ts` (server lama) dipakai waktu tiba paket.
- Kinerja gambar: lantai kayu satu mesh instansi; perabot, awan, dan bagian tubuh karakter yang kaku digabung per kelompok oleh `src/merge.jsx` (satu draw call untuk bahan toon, satu untuk garis tepi; mesh asli hanya disembunyikan); Office, SkyDeco, Player, dan Humanoid dibungkus `memo`. `?perf` menampilkan FPS dan draw call, `?q=0..3` memaksa tingkat kualitas dan menyimpannya; `src/AutoQuality.jsx` menurunkan kualitas otomatis bila di bawah 24 fps tiga detik berturut-turut.
- Gerak karakter dihitung dari jarak yang ditempuh grup induknya (`Humanoid.jsx`), bukan dari prop. Semua penghalusan memakai `damp` dan `dampAngle` di `src/motion.js` supaya sama di semua frame rate. Posisi pemain dikirim tiap 50 ms. Untuk pemain lain, `Peer` memberi `Humanoid` kecepatan dari segmen interpolasi (`sample().v`, prop `motion`), bukan dari selisih posisi antar frame.
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
- Kontrol sesi Claude adalah permukaan serangan: server menerima sambungan dari jaringan, jadi `/api/control` dan `/api/sessions*` menolak selain loopback, Host dan Origin non-lokal, dan permintaan tanpa header `X-Kantor-Token` (dibuat acak tiap server start, diambil dashboard lewat `/api/control`). Pemain lain hanya melihat karakter dan bubble generik. Jangan melonggarkan penjaga ini.
- Menjalankan `claude` dari server memakai login pemilik di komputer ini. Dokumentasi Claude Code melarang menyalurkan login langganan ke pengguna lain lewat aplikasi pihak ketiga dan tidak membahas skrip pribadi secara eksplisit; fitur ini hanya boleh dimulai oleh pemilik komputer. Bila orang lain boleh memberi tugas, harus pindah ke API key. Sesi tanpa `--bare` ikut menjalankan hook dan MCP milik proyek targetnya.
- Hook Claude Code harus dipasang sendiri di `.claude/settings.json` (contoh di `README.md`); URL-nya memakai port 3000. Endpoint `/api/events` menolak selain loopback dan selalu menjawab 200 untuk payload rusak supaya hook tidak mencatat kegagalan.
- Riwayat chat (30 pesan) hanya di memori server dan hilang saat restart.
- Rata-rata waktu di "Report tim" dihitung dari task dibuat sampai selesai, jadi ikut menghitung waktu antre.
- Warna perabot di `Office.jsx` masih literal di JSX (belum lewat token). Lantai kayu dan kaca masih memakai bahan standar tanpa garis tepi.
- Peringatan lint lama masih ada di `Office.jsx` (fungsi `Window` dan variabel `shade` tidak terpakai).
- Satu proses server, state di memori: tidak bisa di-scale horizontal tanpa memindahkan state agent dan peer keluar proses.
- Balasan chat dan DM agent adalah kalimat kaleng acak, bukan LLM; `output` task juga teks hasil generate acak.
- `updateTask` membangun SQL dari nama kolom yang dikirim pemanggil; hanya boleh dipanggil dengan kunci yang hardcoded di server, jangan pernah meneruskan field dari request body.
- Test mencakup antrian dan pemulihan task (`server/db.test.js`), parser hook (`server/live.test.js`), penjaga kontrol (`server/control.test.js`), mesin sesi dengan Claude palsu di `server/fixtures/fake-claude.mjs` (`server/sessions.test.js`), interpolasi (`server/interp.test.js`), proyek (`server/projects.test.js`), dan pembaca kit (`server/kit.test.js`); WebSocket, simulasi agent, dan UI belum punya test. `npm run lint` (oxlint) masih mengeluarkan peringatan lama.

> Do not store secrets, tokens, passwords, or private credentials here.
