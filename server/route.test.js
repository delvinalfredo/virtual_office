import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OBSTACLES, DESK_SEATS, SPOTS, SEATS, MEET_LEAD, resolveObstacles, clampToRoom } from '../src/office-plan.js'
import { TOILET, plan } from './route.js'

// Mensimulasikan jalan agent seperti loop server: titik singgah dari plan(), langkah 0,175 per tick (3,5 per detik),
// dan tabrakan yang sama dengan server. Gagal bila agent tidak sampai dalam 50 detik, yaitu macet.
function walk(from, spot, at) {
  const a = { x: from.x, z: from.z, tx: spot.ax ?? spot.x, tz: spot.az ?? spot.z }
  const crossing = TOILET.inside(a) !== TOILET.inside({ x: a.tx, z: a.tz })
  const vias = plan(a, [...(at?.via ? [at.via] : []), ...(crossing ? [TOILET.door] : []), ...(spot.via ? [spot.via] : [])])
  const p = { x: a.x, z: a.z }
  for (let i = 0; i < 1000; i++) {
    const v = vias[0]
    const gx = v ? v.x : a.tx
    const gz = v ? v.z : a.tz
    const d = Math.hypot(gx - p.x, gz - p.z)
    if (d <= 0.35) {
      if (v) { vias.shift(); continue }
      return null
    }
    const step = Math.min(0.175, d)
    const o = { x: p.x + ((gx - p.x) / d) * step, z: p.z + ((gz - p.z) / d) * step }
    clampToRoom(o)
    resolveObstacles(o, 0.5)
    p.x = o.x
    p.z = o.z
  }
  return `macet di ${p.x.toFixed(2)},${p.z.toFixed(2)}`
}

const targets = [
  ...Object.entries(SPOTS).flatMap(([act, list]) => list.map((sp) => ({ name: `${act}:${sp.key}`, sp }))),
  ...SEATS.map((sp) => ({ name: `rapat:${sp.key}`, sp })),
  { name: 'rapat:lead', sp: MEET_LEAD },
  ...Object.entries(DESK_SEATS).map(([id, sp]) => ({ name: `meja:${id}`, sp })),
]

// acak yang tetap sama di tiap jalan (benih tetap), supaya tes deterministik
let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const nearObstacle = (p) => OBSTACLES.some(([cx, cz, hw, hz]) => Math.abs(p.x - cx) < hw + 0.45 && Math.abs(p.z - cz) < hz + 0.45)
const randomStarts = []
while (randomStarts.length < 60) {
  const p = { x: +(rnd() * 22 - 11).toFixed(2), z: +(rnd() * 22 - 11).toFixed(2) }
  // bilik toilet dilewati: agent hanya ada di sana lewat pintunya
  if (!TOILET.inside(p) && !nearObstacle(p)) randomStarts.push(p)
}

test('agent dari titik mana pun di lantai sampai ke semua tempat pakai tanpa macet', () => {
  const stuck = []
  for (const t of targets) for (const s of randomStarts) {
    const r = walk(s, t.sp)
    if (r) stuck.push(`${t.name} dari ${s.x},${s.z}: ${r}`)
  }
  assert.deepEqual(stuck, [])
})

test('agent yang duduk atau berdiri di sebuah tempat bisa pergi ke tempat lain tanpa macet', () => {
  const stuck = []
  for (const from of targets) for (const to of targets) {
    if (from === to || (from.name.startsWith('toilet:') && to.name.startsWith('toilet:'))) continue
    const r = walk({ x: from.sp.x, z: from.sp.z }, to.sp, from.sp)
    if (r) stuck.push(`${from.name} ke ${to.name}: ${r}`)
  }
  assert.deepEqual(stuck, [])
})
