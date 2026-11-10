// Tampilan tiap karakter: warna, gaya rambut, perlengkapan. Karakter orisinal per role kantor.
// `tag` = warna pil nama (terang, teks gelap supaya kontras lolos). Agent punya tampilan tetap,
// pemain lain dibuat dari hash namanya supaya tidak kembar dan tetap sama di tiap layar.
export const INK = '#1c2233'

const LOOKS = {
  kamu: {
    label: 'Kamu', tag: '#ffd23f', skin: '#ffd9b8', hair: '#2b2118', eye: '#3b2a1e',
    hairStyle: 'spiky', shirt: '#ff9f1c', pants: '#3a5fc8', shoes: INK, gear: ['scarf'],
  },
  prog1: {
    label: 'Programmer', tag: '#9ccbff', skin: '#f2c194', hair: '#4a2f1d', eye: '#2a5db0',
    hairStyle: 'messy', shirt: '#3a86ff', pants: '#2c3e50', shoes: '#f4f1ea', gear: ['glasses'],
  },
  prog2: {
    label: 'Programmer 2', tag: '#7fe0d0', skin: '#e0ac7e', hair: '#1c1a1f', eye: '#3b2a1e',
    hairStyle: 'curly', shirt: '#14a8a0', pants: '#33393f', shoes: '#f4f1ea', gear: ['glasses'],
  },
  designer: {
    label: 'Designer', tag: '#d8c4ff', skin: '#ffd9b8', hair: '#a0432e', eye: '#2f6f4f',
    hairStyle: 'long', shirt: '#8e5ef2', pants: '#3d3d4e', shoes: '#ffd23f', gear: ['beret'],
  },
  qa: {
    label: 'QA', tag: '#9eeccf', skin: '#c68863', hair: '#1c1a1f', eye: '#3b2a1e',
    hairStyle: 'short', shirt: '#06a77d', pants: '#2c3e50', shoes: INK, gear: ['cap'],
  },
  lead: {
    label: 'Tech Lead', tag: '#ffc48a', skin: '#f2c194', hair: '#8a8f99', eye: '#3b2a1e',
    hairStyle: 'swept', shirt: '#2b3a67', pants: '#26333f', shoes: INK, gear: ['headphones', 'beard'],
  },
}

const SKINS = ['#ffd9b8', '#f2c194', '#e0ac7e', '#c68863']
const HAIRS = ['#2b2118', '#4a2f1d', '#7a3b1e', '#c9a227', '#1c1a1f', '#8a8f99']
const STYLES = ['short', 'spiky', 'messy', 'curly', 'bob', 'bun']
const SHIRTS = ['#ef476f', '#06a77d', '#ff9f1c', '#ff6f9c', '#14b8a6', '#8e5ef2', '#3a86ff']
const TAGS = ['#ffc2d1', '#9eeccf', '#ffd49a', '#ffc4d6', '#8ee8dd', '#d8c4ff', '#a9cdff']
const EYES = ['#3b2a1e', '#2f6f4f', '#2a5db0', '#6b3f26']
const PANTS = ['#2c3e50', '#3a5fc8', '#33393f', '#4a3f6b']
const GEARS = [[], ['glasses'], ['cap'], ['beret'], ['headphones']]

const hash = (s) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h >>> 0
}
const pick = (arr, h, shift) => arr[(h >>> shift) % arr.length]

const cache = new Map()
export function lookFor(id) {
  if (LOOKS[id]) return LOOKS[id]
  if (!cache.has(id)) {
    const h = hash(String(id))
    const shirt = (h >>> 3) % SHIRTS.length
    cache.set(id, {
      label: String(id), tag: TAGS[shirt], skin: pick(SKINS, h, 5), hair: pick(HAIRS, h, 8),
      eye: pick(EYES, h, 11), hairStyle: pick(STYLES, h, 13), shirt: SHIRTS[shirt],
      pants: pick(PANTS, h, 17), shoes: INK, gear: pick(GEARS, h, 21),
    })
  }
  return cache.get(id)
}
