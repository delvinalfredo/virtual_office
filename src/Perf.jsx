import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Pengukur kinerja: tambahkan ?perf ke alamat halaman. Tampil di pojok kanan atas:
// FPS rata-rata, frame terlama dalam satu detik, jumlah draw call dan segitiga per frame.
// Angka yang sama ada di window.__perf untuk pengujian otomatis.
export default function Perf({ quality = 0 }) {
  const gl = useThree((s) => s.gl)
  const el = useRef(null)
  const acc = useRef({ t: 0, n: 0, worst: 0 })

  useEffect(() => {
    const d = document.createElement('div')
    d.className = 'perf panel'
    document.body.appendChild(d)
    el.current = d
    return () => { d.remove(); el.current = null }
  }, [])

  useFrame((_, dt) => {
    const a = acc.current
    a.t += dt
    a.n++
    a.worst = Math.max(a.worst, dt)
    if (a.t < 1) return
    const r = gl.info.render
    const p = { fps: Math.round(a.n / a.t), worstMs: Math.round(a.worst * 1000), calls: r.calls, triangles: r.triangles, quality }
    window.__perf = p
    if (el.current) el.current.textContent = `${p.fps} fps, terburuk ${p.worstMs} ms, ${p.calls} draw call, ${Math.round(p.triangles / 1000)}k segitiga, kualitas ${quality}`
    acc.current = { t: 0, n: 0, worst: 0 }
  })

  return null
}
