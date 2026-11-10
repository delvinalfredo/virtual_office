import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DELAY, noteServerTime, push, sample, resetInterp } from '../src/interp.js'

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} bukan ${b}`)

test('gerak konstan walau paket tiba bergerombol: jaraknya selalu sebanding dengan waktu', () => {
  resetInterp()
  // server mengirim posisi tiap 50 ms, bergerak 0,175 tiap paket (3,5 satuan per detik)
  // tetapi paket tiba tidak rata: dua sekaligus, lalu jeda
  const arrivals = [0, 20, 20, 130, 140, 240, 250, 350]
  arrivals.forEach((recv, n) => { noteServerTime('agent', n * 50, recv + 1000); push('agent', 'a', n * 50, n * 0.175, 0) })
  // sampling tiap 16,7 ms: kecepatan antar sampel harus konstan 3,5 satuan per detik
  let prev = null
  // selisih jam terkecil dari paket di atas adalah 920, jadi waktu server = waktu klien - 920 - DELAY
  const base = 920 + DELAY.agent
  for (let now = base + 50; now < base + 330; now += 1000 / 60) {
    const p = sample('agent', 'a', now)
    if (prev) near((p.x - prev.x) / (1 / 60), 3.5, 0.02)
    prev = p
  }
})

test('selisih jam: server dan klien dengan jam berbeda tetap sinkron', () => {
  resetInterp()
  for (let n = 0; n < 10; n++) { noteServerTime('agent', 5000 + n * 50, 123456 + n * 50 + (n % 3) * 15); push('agent', 'a', 5000 + n * 50, n, 0) }
  // waktu server 5200 + DELAY terjadi di klien pada 123456 + 200 + DELAY (selisih terkecil = 118456)
  near(sample('agent', 'a', 123456 + 200 + DELAY.agent).x, 4, 1e-6)
})

test('melewati posisi terakhir menahan, sebelum posisi pertama memakai yang pertama, sudut lewat jalur terpendek', () => {
  resetInterp()
  noteServerTime('peer', 0, 0)
  push('peer', 'p', 0, 0, 0, 3.0)
  push('peer', 'p', 100, 1, 0, -3.0) // dari 3,0 ke -3,0 lewat 3,14 (bukan memutar balik lewat 0)
  const mid = sample('peer', 'p', DELAY.peer + 50)
  near(mid.x, 0.5)
  assert.ok(Math.abs(mid.h) > 3.0, `sudut harus lewat sekitar pi, dapat ${mid.h}`)
  near(sample('peer', 'p', DELAY.peer + 5000).x, 1)
  near(sample('peer', 'p', DELAY.peer - 5000).x, 0)
})

test('paket ganda atau terlambat dan nilai rusak diabaikan; tanpa data hasilnya null', () => {
  resetInterp()
  assert.equal(sample('agent', 'x', 1000), null)
  noteServerTime('agent', 0, 0)
  push('agent', 'x', 100, 1, 1)
  push('agent', 'x', 100, 9, 9)
  push('agent', 'x', 50, 8, 8)
  push('agent', 'x', NaN, 1, 1)
  push('agent', 'x', 200, Infinity, 1)
  near(sample('agent', 'x', 100000).x, 1)
})

test('jam pengirim: jitter tiba tidak mengubah gerak, dan tiap pemain punya selisih jamnya sendiri', () => {
  resetInterp()
  // dua pemain dengan jam browser yang jauh berbeda; paket tiba tidak rata (jitter sampai 60 ms)
  const jitter = [0, 55, 5, 60, 10, 40, 0, 50, 20, 60, 5, 45]
  for (let n = 0; n < 12; n++) {
    const recv = 1000 + n * 50 + jitter[n]
    push('peer', 'a', 100 + n * 50, n * 0.25, 0); noteServerTime('peer', 100 + n * 50, recv, 'a') // 5 satuan per detik
    push('peer', 'b', 900000 + n * 50, 100 - n * 0.25, 0); noteServerTime('peer', 900000 + n * 50, recv, 'b')
  }
  const base = 1000 - 100 // selisih terkecil pemain a (jitter 0 di n = 0)
  let prev = null
  for (let now = base + DELAY.peer + 150; now < base + DELAY.peer + 450; now += 1000 / 60) {
    const p = sample('peer', 'a', now)
    if (prev) near((p.x - prev.x) / (1 / 60), 5, 0.02)
    near(p.v, 5, 1e-6)
    prev = p
  }
})

test('kecepatan jalan: nol saat menahan atau melompat jauh, dan jam mundur (muat ulang) memulai riwayat baru', () => {
  resetInterp()
  noteServerTime('peer', 0, 0, 'p')
  push('peer', 'p', 0, 0, 0)
  push('peer', 'p', 100, 0.5, 0) // 5 satuan per detik
  push('peer', 'p', 200, 30, 0) // loncat 29,5 dalam 100 ms: teleport, bukan jalan
  near(sample('peer', 'p', DELAY.peer + 50).v, 5)
  near(sample('peer', 'p', DELAY.peer + 150).v, 0)
  near(sample('peer', 'p', DELAY.peer + 9000).v, 0) // lewat paket terakhir: menahan
  // pemain yang sama muat ulang: jam browser mulai dari nol lagi
  noteServerTime('peer', 5000000, 5000000, 'p')
  push('peer', 'p', 5000000, 7, 7)
  assert.equal(push('peer', 'p', 40, 1, 1), true, 'jam mundur jauh = sesi baru, bukan paket terlambat')
  noteServerTime('peer', 40, 9000, 'p') // useKantor mencatat jam baru tepat setelah push berhasil
  near(sample('peer', 'p', 1e9).x, 1)
})
