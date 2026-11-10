// Interpolasi posisi karakter lain (agent dan pemain). Server mengirim posisi 20 kali per detik (agent) atau
// 10 kali (pemain) dengan waktu tiba yang tidak rata. Daripada mengejar posisi terbaru, tiap posisi disimpan
// bersama cap waktu server, lalu karakter digambar sedikit di masa lalu di antara dua posisi. Geraknya jadi
// konstan walau paket datang bergerombol, dan animasi kaki tidak berkedip.
import { lerpAngle } from './motion.js'

// Seberapa jauh di belakang waktu server karakter digambar: cukup untuk dua sampai tiga paket.
export const DELAY = { agent: 120, peer: 220 }
const KEEP = 24

const tracks = { agent: new Map(), peer: new Map() }
const offsets = { agent: [], peer: [] }

// Selisih jam server dan klien. Paket tidak pernah tiba lebih cepat dari kenyataan, jadi selisih terkecil
// dari beberapa paket terakhir adalah yang paling mendekati benar.
function offsetOf(kind) {
  const list = offsets[kind]
  return list.length ? Math.min(...list) : null
}

export function noteServerTime(kind, serverTs, recvMs) {
  if (!Number.isFinite(serverTs)) return
  const list = offsets[kind]
  list.push(recvMs - serverTs)
  if (list.length > 40) list.shift()
}

export function push(kind, id, ts, x, z, h = 0, level = 0) {
  if (!Number.isFinite(ts) || !Number.isFinite(x) || !Number.isFinite(z)) return false
  const t = tracks[kind].get(id) ?? []
  if (t.length && t[t.length - 1].ts >= ts) return false // paket ganda atau terlambat
  t.push({ ts, x, z, h: Number.isFinite(h) ? h : 0, level })
  if (t.length > KEEP) t.shift()
  tracks[kind].set(id, t)
  return true
}

export function sample(kind, id, nowMs = performance.now()) {
  const t = tracks[kind].get(id)
  const off = offsetOf(kind)
  if (!t?.length || off === null) return null
  const rt = nowMs - off - DELAY[kind]
  if (rt <= t[0].ts) return t[0]
  const last = t[t.length - 1]
  if (rt >= last.ts) return last // melewati posisi terakhir: tahan, jangan menebak
  let i = t.length - 2
  while (i > 0 && t[i].ts > rt) i--
  const a = t[i]
  const b = t[i + 1]
  const k = (rt - a.ts) / (b.ts - a.ts)
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: lerpAngle(a.h, b.h, k), level: b.level }
}

// dipanggil saat sambungan baru: jam dan riwayat lama tidak berlaku lagi
export function resetInterp() {
  for (const k of Object.keys(tracks)) { tracks[k].clear(); offsets[k].length = 0 }
}
