import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Menurunkan kualitas gambar bertahap bila komputer tidak sanggup: kurang dari 24 fps selama tiga jendela
// satu detik berturut-turut, setelah 5 detik pertama (kompilasi shader membuat awal selalu lambat).
// Hanya turun, tidak naik lagi otomatis, supaya tidak bolak-balik. Pilihan terakhir diingat di browser.
// ?minfps=100 di alamat halaman memaksa penurunan, untuk menguji
const MIN_FPS = Number(new URLSearchParams(location.search).get('minfps')) || 24
const BAD_WINDOWS = 3
const WARMUP = 5

export default function AutoQuality({ quality, onDrop }) {
  const s = useRef({ t: 0, n: 0, age: 0, bad: 0 })
  useFrame((_, dt) => {
    const a = s.current
    // tab disembunyikan lalu dibuka lagi: celah panjang antar frame bukan tanda komputer lambat
    if (dt > 0.5 || document.hidden) { a.t = 0; a.n = 0; a.bad = 0; return }
    a.age += dt
    a.t += dt
    a.n++
    if (a.t < 1) return
    const fps = a.n / a.t
    a.t = 0
    a.n = 0
    if (a.age < WARMUP || quality >= 3) return
    a.bad = fps < MIN_FPS ? a.bad + 1 : 0
    if (a.bad >= BAD_WINDOWS) {
      a.bad = 0
      const next = quality + 1
      try { localStorage.setItem('kantor-q', String(next)) } catch { /* abaikan */ }
      onDrop(next)
    }
  })
  return null
}
