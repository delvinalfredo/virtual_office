import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadKitAgents, writeAgentsFile, orchestrationPrompt, shellOf, installKit } from './kit.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-kit-'))
const put = (name, text) => fs.writeFileSync(path.join(tmp, name), text)

test('agent kit dibaca dari frontmatter; berkas rusak atau bernama aneh dilewati', () => {
  put('planner.md', '---\nname: planner\ndescription: Merencanakan\ntools: Read, Grep, Glob\n---\n\nIsi peran planner.\n')
  put('tanpa-tools.md', '---\nname: bebas\ndescription: Tanpa batas tool\n---\nIsi.')
  put('rusak.md', 'tidak ada frontmatter')
  put('nama-aneh.md', '---\nname: ../../etc\ndescription: x\n---\nIsi')
  put('kosong.md', '---\nname: kosong\ndescription: x\n---\n')
  put('catatan.txt', 'bukan md')
  const kit = loadKitAgents(tmp)
  assert.deepEqual(Object.keys(kit).sort(), ['bebas', 'planner'])
  // planner tidak menulis model di berkasnya, jadi memakai model bawaan perannya
  assert.deepEqual(kit.planner, { description: 'Merencanakan', prompt: 'Isi peran planner.', tools: ['Read', 'Grep', 'Glob'], model: 'opus' })
  assert.equal('tools' in kit.bebas, false)
  assert.equal('model' in kit.bebas, false) // peran di luar tabel ikut model sesi
  assert.deepEqual(loadKitAgents(path.join(tmp, 'tidak-ada')), {})
})

test('instruksi orkestrasi memisahkan subagent pembaca (paralel) dan penulis (berurutan)', () => {
  const text = orchestrationPrompt({
    planner: { tools: ['Read', 'Grep'] },
    'security-reviewer': { tools: ['Read', 'Bash'] },
    'tdd-guide': { tools: ['Read', 'Write', 'Bash'] },
    'build-fix': { tools: ['Edit'] },
  })
  const line = (start) => text.split('\n').find((l) => l.startsWith(start))
  const readers = line('Subagent yang hanya membaca')
  const writers = line('Subagent yang mengubah file')
  assert.match(readers, /planner, security-reviewer/)
  assert.doesNotMatch(readers, /tdd-guide|build-fix/)
  assert.match(writers, /tdd-guide, build-fix/)
  assert.doesNotMatch(writers, /planner|security-reviewer/)
  assert.match(text, /npm test/) // bentuk perintah shell disebut persis
})

test('berkas definisi: isi sama memakai berkas sama, isi beda berkas beda', () => {
  const a = writeAgentsFile({ x: { description: 'a', prompt: 'p' } }, tmp)
  assert.equal(writeAgentsFile({ x: { description: 'a', prompt: 'p' } }, tmp), a)
  const b = writeAgentsFile({ x: { description: 'a', prompt: 'q' } }, tmp)
  assert.notEqual(a, b)
  assert.deepEqual(JSON.parse(fs.readFileSync(a, 'utf8')), { x: { description: 'a', prompt: 'p' } })
})

test('model di berkas agent menang atas bawaan; deskripsi blok YAML dari agent luar terbaca', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-kit-m-'))
  fs.writeFileSync(path.join(dir, 'planner.md'), '---\nname: planner\ndescription: x\nmodel: haiku\n---\nIsi')
  fs.writeFileSync(path.join(dir, 'luar.md'), '---\nname: luar\ndescription: >\n  Baris satu\n  baris dua\ntools: Read\nmodel: tidak-dikenal\n---\nIsi')
  const kit = loadKitAgents(dir)
  assert.equal(kit.planner.model, 'haiku')
  assert.equal(kit.luar.description, 'Baris satu baris dua')
  assert.deepEqual(kit.luar.tools, ['Read'])
  assert.equal('model' in kit.luar, false)
})

test('instruksi shell mengikuti izin proyek: tanpa izin dilarang, dengan izin disebut persis', () => {
  assert.deepEqual(shellOf(['Read', 'Bash(npm test)', 'Bash(npm install *)']), ['npm test', 'npm install *'])
  assert.match(orchestrationPrompt({}, []), /Perintah shell tidak diizinkan/)
  const withShell = orchestrationPrompt({}, ['npm test', 'npm install *'])
  assert.match(withShell, /'npm test'/)
  assert.match(withShell, /berawalan: 'npm install'/)
})

test('memasang kit ke proyek: berkas yang sudah ada di proyek tidak ditimpa', () => {
  const kitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-kit-src-'))
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'kantor-kit-dst-'))
  fs.mkdirSync(path.join(kitRoot, '.claude', 'agents'), { recursive: true })
  fs.writeFileSync(path.join(kitRoot, '.claude', 'agents', 'planner.md'), 'dari kit')
  fs.writeFileSync(path.join(kitRoot, 'CLAUDE.md'), 'aturan kit')
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'milik proyek')
  assert.deepEqual(installKit(kitRoot, proj), { copied: 1 })
  assert.equal(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8'), 'milik proyek')
  assert.equal(fs.readFileSync(path.join(proj, '.claude', 'agents', 'planner.md'), 'utf8'), 'dari kit')
  assert.deepEqual(installKit(kitRoot, proj), { copied: 0 })
})
