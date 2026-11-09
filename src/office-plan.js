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

// zona portal: naik ke rooftop (pintu ungu dinding depan), turun lewat titik kanan rooftop
export const PORTAL_UP = { x: 0, z: WALL - 1.2, r: 1.0 }          // sentuh → teleport ke rooftop
export const PORTAL_DOWN = { x: WALL - 2, z: WALL - 2, r: 1.0, y: 3.05 } // di rooftop, sentuh → turun

// level player saat ini: 0 = lantai kantor, 1 = rooftop
export function clampToRoom(p, half = 0.4, level = 0) {
  const lim = WALL - half
  p.x = Math.max(-lim, Math.min(lim, p.x))
  p.z = Math.max(-lim, Math.min(lim, p.z))
}

// rooftop: pulau taman melayang di tepi — pemain tidak boleh nyangkut di dlmnya
export const ROOFTOP_OBSTACLES = [
  [-10.5, -10.5, 1.5, 1.5],
  [10.5, -10.5, 1.5, 1.5],
  [-10.5, 2, 1.4, 1.4],
  [10.5, 2, 1.4, 1.4],
  [0, -11.5, 1.3, 1.3],
]

// cek & proses portal; return level baru bila pindah (0/1), atau null
export function portalCheck(p, level, r = 0.8) {
  if (level === 0 && Math.hypot(p.x - PORTAL_UP.x, p.z - PORTAL_UP.z) < PORTAL_UP.r) {
    // naik → muncul dari titik keluar rooftop dekat portalnya
    p.x = PORTAL_DOWN.x + 1.4
    p.z = PORTAL_DOWN.z
    return 1
  }
  if (level === 1 && Math.hypot(p.x - PORTAL_DOWN.x, p.z - PORTAL_DOWN.z) < PORTAL_DOWN.r) {
    // turun → muncul dekat pintu lantai 1
    p.x = PORTAL_UP.x + 1.5
    p.z = PORTAL_UP.z - 0.5
    return 0
  }
  return null
}

// dorong keluar dari kotak obstacle (media lingkaran radius r)
export function resolveObstacles(p, r = 0.4, level = 0) {
  const obs = level === 1 ? ROOFTOP_OBSTACLES : OBSTACLES
  for (const [cx, cz, hw, hz] of obs) {
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
