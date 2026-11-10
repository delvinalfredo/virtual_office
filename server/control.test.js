import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkControl } from './control.js'

const ok = { remoteAddress: '127.0.0.1', host: 'localhost:3000', origin: undefined, token: 'abc' }

test('permintaan lokal dengan token benar diizinkan', () => {
  assert.equal(checkControl(ok, 'abc'), null)
  assert.equal(checkControl({ ...ok, remoteAddress: '::1', host: '127.0.0.1:1234', origin: 'http://localhost:1234' }, 'abc'), null)
  assert.equal(checkControl({ ...ok, remoteAddress: '::ffff:127.0.0.1' }, 'abc'), null)
})

test('sambungan dari jaringan ditolak walau token benar', () => {
  assert.match(checkControl({ ...ok, remoteAddress: '192.168.1.20', host: '192.168.1.5:3000' }, 'abc'), /komputer ini/)
})

test('DNS rebinding: Host dari domain asing ditolak', () => {
  assert.match(checkControl({ ...ok, host: 'evil.example.com:3000' }, 'abc'), /host/)
  assert.match(checkControl({ ...ok, host: 'localhost.evil.com' }, 'abc'), /host/)
})

test('halaman web asing: Origin non-lokal ditolak', () => {
  assert.match(checkControl({ ...ok, origin: 'https://evil.example.com' }, 'abc'), /asal/)
  assert.match(checkControl({ ...ok, origin: 'bukan-url' }, 'abc'), /asal/)
})

test('token salah, kosong, atau bukan teks ditolak; tanpa token wajib hanya untuk endpoint token', () => {
  assert.match(checkControl({ ...ok, token: 'salah' }, 'abc'), /token/)
  assert.match(checkControl({ ...ok, token: undefined }, 'abc'), /token/)
  assert.match(checkControl({ ...ok, token: ['abc'] }, 'abc'), /token/)
  assert.equal(checkControl({ ...ok, token: undefined }, 'abc', { needToken: false }), null)
  // pemeriksaan alamat tetap berlaku walau token tidak diwajibkan
  assert.match(checkControl({ ...ok, remoteAddress: '10.0.0.9', token: undefined }, 'abc', { needToken: false }), /komputer ini/)
})
