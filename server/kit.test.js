import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadKitAgents, writeAgentsFile, orchestrationPrompt } from './kit.js'

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
  assert.deepEqual(kit.planner, { description: 'Merencanakan', prompt: 'Isi peran planner.', tools: ['Read', 'Grep', 'Glob'] })
  assert.equal('tools' in kit.bebas, false)
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
