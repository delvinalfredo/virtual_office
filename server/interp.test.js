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
