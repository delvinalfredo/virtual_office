// Denah kantor yang dipakai client (render + collision player) dan server
// (path agent). Sumber tunggal supaya collision konsisten.
export const WALL = 12

// obstacle: [cx, cz, halfW, halfZ] — kotak AABB di lantai
export const OBSTACLES = [
  // 4 meja kerja (2.4 x 1.2 + margin)
  [-4, 4, 1.3, 0.75],
  [-4, 1, 1.3, 0.75],
  [4, 4, 1.3, 0.75],
  [4, 1, 1.3, 0.75],
  // meja meeting (4 x 2)
  [0, -7, 2.2, 1.2],
  // lounge: sofa & meja pingpong
  [-8, 10.5, 1.2, 0.55],
  [-10.6, 7, 0.55, 1.2],
  [-6.5, 6, 1.3, 0.8],
]

export function clampToRoom(p, half = 0.4) {
  const lim = WALL - half
  p.x = Math.max(-lim, Math.min(lim, p.x))
  p.z = Math.max(-lim, Math.min(lim, p.z))
}

// dorong keluar dari kotak obstacle (media lingkaran radius r)
export function resolveObstacles(p, r = 0.4) {
  for (const [cx, cz, hw, hz] of OBSTACLES) {
    // titik terdekat pada AABB
    const nx = Math.max(cx - hw, Math.min(p.x, cx + hw))
    const nz = Math.max(cz - hz, Math.min(p.z, cz + hz))
    const dx = p.x - nx
    const dz = p.z - nz
    const d2 = dx * dx + dz * dz
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.0001
      // dorong keluar sepanjang normal
      p.x = nx + (dx / d) * r
      p.z = nz + (dz / d) * r
    }
  }
}
