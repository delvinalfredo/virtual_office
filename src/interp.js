// Interpolasi posisi karakter lain (agent dan pemain). Server mengirim posisi 20 kali per detik (agent) atau
// 10 kali (pemain) dengan waktu tiba yang tidak rata. Daripada mengejar posisi terbaru, tiap posisi disimpan
// bersama cap waktu server, lalu karakter digambar sedikit di masa lalu di antara dua posisi. Geraknya jadi
// konstan walau paket datang bergerombol, dan animasi kaki tidak berkedip.
import { lerpAngle } from './motion.js'

// Seberapa jauh di belakang waktu server karakter digambar: cukup untuk dua sampai tiga paket.
export const DELAY = { agent: 120, peer: 220 }
const KEEP = 24
const RESTART_GAP = 2000

// Kecepatan di atas ini dianggap lompatan (teleport lewat minimap, sambungan ulang), bukan berjalan.
const MAX_WALK = 14

const tracks = { agent: new Map(), peer: new Map() }
// Tiap sumber jam punya daftar selisihnya sendiri. Agent memakai satu jam server ('*'); tiap pemain memakai
// jam browser pengirimnya sendiri, jadi jitter server dan jaringan tidak ikut masuk ke garis waktu geraknya.
const offsets = { agent: new Map(), peer: new Map() }

// Selisih jam sumber dan klien. Paket tidak pernah tiba lebih cepat dari kenyataan, jadi selisih terkecil
// dari beberapa paket terakhir adalah yang paling mendekati benar.
function offsetOf(kind, id) {
  const list = offsets[kind].get(id) ?? offsets[kind].get('*')
  return list?.length ? Math.min(...list) : null
}

export function noteServerTime(kind, serverTs, recvMs, clock = '*') {
  if (!Number.isFinite(serverTs)) return
  const list = offsets[kind].get(clock) ?? []
  list.push(recvMs - serverTs)
  if (list.length > 40) list.shift()
  offsets[kind].set(clock, list)
}

export function push(kind, id, ts, x, z, h = 0) {
  if (!Number.isFinite(ts) || !Number.isFinite(x) || !Number.isFinite(z)) return false
  let t = tracks[kind].get(id) ?? []
  // jam mundur jauh: pengirim memuat ulang halaman (jamnya mulai dari nol lagi), riwayat lamanya tak berlaku
  if (t.length && ts < t[t.length - 1].ts - RESTART_GAP) {
    t = []
    offsets[kind].delete(id)
  }
  if (t.length && t[t.length - 1].ts >= ts) return false // paket ganda atau terlambat
  t.push({ ts, x, z, h: Number.isFinite(h) ? h : 0 })
  if (t.length > KEEP) t.shift()
  tracks[kind].set(id, t)
  return true
}

export function sample(kind, id, nowMs = performance.now()) {
  const t = tracks[kind].get(id)
  const off = offsetOf(kind, id)
  if (!t?.length || off === null) return null
  const rt = nowMs - off - DELAY[kind]
  if (rt <= t[0].ts) return { ...t[0], v: 0 }
  const last = t[t.length - 1]
  if (rt >= last.ts) return { ...last, v: 0 } // melewati posisi terakhir: tahan, jangan menebak
  let i = t.length - 2
  while (i > 0 && t[i].ts > rt) i--
  const a = t[i]
  const b = t[i + 1]
  const k = (rt - a.ts) / (b.ts - a.ts)
  // v: kecepatan jalan (satuan per detik) pada segmen ini, untuk langkah kaki. Lompatan jauh bukan berjalan.
  const v = Math.hypot(b.x - a.x, b.z - a.z) / ((b.ts - a.ts) / 1000)
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: lerpAngle(a.h, b.h, k), v: v < MAX_WALK ? v : 0 }
}

// dipanggil saat sambungan baru: jam dan riwayat lama tidak berlaku lagi
export function resetInterp() {
  for (const k of Object.keys(tracks)) { tracks[k].clear(); offsets[k].clear() }
}
