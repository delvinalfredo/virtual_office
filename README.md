# Virtual Kantor

Kantor 3D multiplayer. Lima agent simulasi (dua programmer, designer, QA, tech lead) mengerjakan task yang kamu masukkan. Pemain lain bisa masuk dan jalan-jalan di kantor yang sama.

## Menjalankan

Butuh Node 22 atau lebih baru.

```bash
npm install
npm start        # server di http://localhost:3000 (REST, WebSocket, simulasi agent)
npm run dev      # terminal kedua: Vite di http://localhost:5173, proxy ke server
```

Untuk produksi: `npm run build`, lalu `npm start`. Express menyajikan folder `dist/` sendiri. Port bisa diganti lewat env `PORT`.

## Perintah lain

```bash
npm test         # test antrian task dan pemulihan setelah restart
npm run lint     # oxlint
```

## Kontrol

- WASD atau panah untuk jalan, Q/E untuk memutar kamera, scroll untuk zoom.
- Enter membuka chat, Esc menutupnya.
- Klik avatar agent untuk kirim pesan langsung.
- Kolom Nama di kiri bawah mengganti namamu. Nama disimpan di browser.

## Memantau Claude Code di kantor

Kantor bisa menampilkan subagent Claude Code yang sedang bekerja sungguhan. Setiap subagent muncul sebagai karakter tamu: masuk lewat pintu, duduk di ruang meeting, bubble-nya mengikuti tool yang dipakai, lalu berkonfeti dan pulang saat selesai. Kantor hanya menerima event dari hook Claude Code. Ia tidak memanggil Claude dan tidak memegang kredensialmu.

Cara paling mudah: salin perintah `/virtual` sekali dengan `mkdir -p ~/.claude/commands && cp scripts/virtual.md ~/.claude/commands/virtual.md`, lalu di Claude Code proyek mana pun ketik `/virtual` (pasang), `/virtual status`, `/virtual hapus`, atau `/virtual demo`. Perintah itu menjalankan skrip di bawah, dan skripnya cukup dijalankan sekali karena menulis ke pengaturan global.

Tanpa perintah slash, untuk semua proyek sekaligus: jalankan `node scripts/pasang-hook.mjs`. Skrip itu menyimpan cadangan `settings.json.bak-kantor`, menambahkan hook ke `~/.claude/settings.json` tanpa mengubah isi lainnya, dan bisa dicabut dengan `node scripts/pasang-hook.mjs --hapus`. Untuk mencoba tanpa Claude Code, jalankan `node scripts/demo-agen.mjs` dan lihat tiga tamu agen masuk, bekerja, lalu pulang.

Cara manual: pasang hook di `.claude/settings.json` proyek yang ingin dipantau, atau di `~/.claude/settings.json` untuk semua proyek. Server kantor harus jalan di port 3000.

```json
{
  "hooks": {
    "SubagentStart": [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3000/api/events", "timeout": 2 }] }],
    "SubagentStop": [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3000/api/events", "timeout": 2 }] }],
    "PreToolUse": [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:3000/api/events", "timeout": 2 }] }]
  }
}
```

Buka `/hooks` di Claude Code atau mulai sesi baru supaya hook terbaca. Kalau server kantor mati, hook gagal tanpa menghalangi apa pun. Dari event hanya nama tool, nama file tanpa folder, dan kata pertama perintah yang dipakai. Isi file dan perintah lengkap tidak disimpan. Untuk mematikan, hapus bagian `hooks` itu.

## Data

Task dan daftar agent disimpan di `server/kantor.db` (SQLite, tidak ikut git). Posisi agent hanya ada di memori server. Kalau server restart, task yang sedang dikerjakan dikembalikan ke antrian.

Aplikasi ini tidak punya login dan tidak membatasi akses. Pakai di jaringan lokal atau untuk demo.
