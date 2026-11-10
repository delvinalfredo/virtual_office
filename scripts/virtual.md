---
description: Pasang, cabut, atau cek hook kantor virtual (subagent Claude Code tampil sebagai karakter)
argument-hint: [pasang | hapus | status | demo]
allowed-tools: Bash(node D:/Kodingan/virtual_office/scripts/*)
---

Argumen dari pengguna: $ARGUMENTS

Kerjakan sesuai argumen. Bila kosong, anggap `pasang`. Jalankan hanya perintah di bawah, tepat seperti tertulis, lalu laporkan hasilnya dalam bahasa Indonesia yang sederhana.

- `pasang`: `node D:/Kodingan/virtual_office/scripts/pasang-hook.mjs`. Setelah berhasil, ingatkan pengguna untuk membuka `/hooks` atau memulai sesi Claude Code baru supaya hook terbaca.
- `hapus`: `node D:/Kodingan/virtual_office/scripts/pasang-hook.mjs --hapus`
- `status`: `node D:/Kodingan/virtual_office/scripts/pasang-hook.mjs --status`
- `demo`: `node D:/Kodingan/virtual_office/scripts/demo-agen.mjs`. Beri tahu pengguna untuk melihat kantor di browser, tiga karakter masuk lalu pulang dalam sekitar 20 detik.

Argumen lain: jangan menjalankan apa pun, cukup tampilkan empat pilihan di atas.
