// Perutean agent. Agent berjalan lurus; kelompok meja dan dinding menghalangi banyak garis lurus, jadi rute dihitung di
// atas beberapa titik koridor tetap. Dipisah dari index.js supaya bisa diuji tanpa menyalakan server.
import { OBSTACLES } from '../src/office-plan.js'

// pintu toilet: tempat di dalam toilet dicapai dan ditinggalkan lewat titik ini
export const TOILET = { door: { x: -9, z: -6.6 }, inside: (p) => p.x < -6.5 && p.z < -7.6 }

export const WAYPOINTS = [
  { x: 0, z: -3.5 }, { x: 0, z: 2.5 }, { x: 0, z: 7.7 },
  { x: -9, z: -3.5 }, { x: -9, z: 2.5 }, { x: -9, z: 5.5 }, { x: 9, z: -3.5 }, { x: 9, z: 2.5 }, { x: 9, z: 7.2 }, { x: 9, z: -6.5 },
  { x: -4, z: 7.7 }, { x: 2, z: 11.3 }, { x: -4, z: 11.3 }, { x: -6, z: 11.2 },
  // lounge, ujung kiri dan kanan meja kopi
  { x: -9.8, z: 11.2 }, { x: -9.8, z: 9.6 }, { x: -6.2, z: 9.6 },
  // di dalam dan di depan pintu ruang meeting, dan dua sisi meja meeting menuju kursi sisi utara
  { x: 0, z: -6.8 }, { x: -3.8, z: -6.8 }, { x: 3.8, z: -6.8 }, { x: -3.8, z: -10.4 }, { x: 3.8, z: -10.4 },
  // di antara ruang makan dan meja pingpong, dan sisi timur meja pingpong
  { x: 7.25, z: 7.9 }, { x: 7.25, z: 11.2 }, { x: 11.2, z: 7.3 },
]
// garis lurus bebas bila tak ada kotak tabrakan lebih dekat dari 0,25 (radius agent 0,5 tetap menyusur tepi dengan aman)
export function free(x0, z0, x1, z1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25))
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const z = z0 + ((z1 - z0) * i) / n
    for (const [cx, cz, hw, hz] of OBSTACLES) {
      const dx = x - Math.max(cx - hw, Math.min(x, cx + hw))
      const dz = z - Math.max(cz - hz, Math.min(z, cz + hz))
      if (dx * dx + dz * dz < 0.0625) return false
    }
  }
  return true
}
// Visibilitas antar titik koridor dihitung sekali (penghalangnya tetap). route() mencari jalur terpendek
// dari titik asal ke tujuan lewat titik-titik itu (Dijkstra), atau [] bila garis lurus sudah bebas atau tidak ada jalur.
const SEE = WAYPOINTS.map((w, i) => WAYPOINTS.map((v, j) => i !== j && free(w.x, w.z, v.x, v.z)))
export function route(from, to) {
  if (free(from.x, from.z, to.x, to.z)) return []
  const n = WAYPOINTS.length
  const dist = WAYPOINTS.map((w) => (free(from.x, from.z, w.x, w.z) ? Math.hypot(w.x - from.x, w.z - from.z) : Infinity))
  const prev = new Array(n).fill(-1)
  const done = new Array(n).fill(false)
  for (let k = 0; k < n; k++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i
    if (u < 0) break
    done[u] = true
    for (let v = 0; v < n; v++) {
      if (!SEE[u][v]) continue
      const d = dist[u] + Math.hypot(WAYPOINTS[v].x - WAYPOINTS[u].x, WAYPOINTS[v].z - WAYPOINTS[u].z)
      if (d < dist[v]) { dist[v] = d; prev[v] = u }
    }
  }
  let best = -1
  let bd = Infinity
  WAYPOINTS.forEach((w, i) => {
    if (dist[i] === Infinity || !free(w.x, w.z, to.x, to.z)) return
    const d = dist[i] + Math.hypot(to.x - w.x, to.z - w.z)
    if (d < bd) { bd = d; best = i }
  })
  const out = []
  for (let i = best; i >= 0; i = prev[i]) out.unshift({ x: WAYPOINTS[i].x, z: WAYPOINTS[i].z })
  // titik yang sudah di kaki agent dibuang: kalau tidak, agent yang baru tiba di sebuah titik memilih titik itu lagi dan diam
  while (out.length && Math.hypot(out[0].x - from.x, out[0].z - from.z) < 0.6) out.shift()
  return out
}
// daftar titik singgah dari posisi agent lewat seq (titik wajib) ke targetnya (a.tx, a.tz), dengan jalur
// koridor disisipkan di tiap ruas yang tidak bebas
export function plan(a, seq) {
  const out = []
  let cur = { x: a.x, z: a.z }
  for (const p of [...seq, { x: a.tx, z: a.tz }]) {
    out.push(...route(cur, p), { x: p.x, z: p.z })
    cur = p
  }
  out.pop() // titik terakhir adalah target sendiri
  return out
}

