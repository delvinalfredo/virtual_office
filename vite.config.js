import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // "localhost" jatuh ke IPv6 (::1) dan di mesin ini Chrome gagal lewat sana (respons kosong / halaman putih);
    // IPv4 jalan normal. `npm run dev -- --host` tetap bisa dipakai untuk akses dari jaringan.
    host: '127.0.0.1',
    proxy: {
      // REST API diarahkan ke server Node (port 3000); websocket tidak lewat sini, klien langsung ke port 3000
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
