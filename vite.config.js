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
      // websocket kantor + REST API diarahkan ke server Node (port 3000)
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
