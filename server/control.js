// Penjaga untuk endpoint yang bisa menjalankan Claude Code di komputer ini.
// Server kantor menerima sambungan dari jaringan (pemain lain), jadi kontrol sesi harus:
//   1. berasal dari komputer ini (alamat loopback),
//   2. memakai Host dan Origin lokal (menahan DNS rebinding dan halaman web asing),
//   3. membawa token yang dibuat acak tiap server start, lewat header khusus (memaksa preflight
//      CORS, sehingga halaman web lain tidak bisa mengirim permintaan ini dari browsermu).
const LOCAL_ADDR = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

// Kembalikan teks alasan penolakan, atau null bila boleh.
export function checkControl({ remoteAddress, host, origin, token }, expectedToken, { needToken = true } = {}) {
  if (!LOCAL_ADDR.has(remoteAddress)) return 'hanya dari komputer ini'
  if (!LOCAL_HOST.test(host ?? '')) return 'host tidak dikenal'
  if (origin) {
    let h
    try { h = new URL(origin).host } catch { return 'asal tidak valid' }
    if (!LOCAL_HOST.test(h)) return 'asal tidak dikenal'
  }
  if (needToken && (typeof token !== 'string' || token !== expectedToken)) return 'token salah'
  return null
}
