// Bahan toon dan outline yang dipakai bersama semua karakter.
// Satu gradient dan satu bahan per warna (di-cache), bukan satu per komponen.
import * as THREE from 'three'
import { INK } from './looks'

let gradient
export function toonGradient() {
  if (!gradient) {
    // tiga pita: bayangan, tengah, terang
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 1
    const g = c.getContext('2d')
    g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, 1, 1)
    g.fillStyle = '#b4b4b4'; g.fillRect(1, 0, 1, 1)
    g.fillStyle = '#ffffff'; g.fillRect(2, 0, 2, 1)
    gradient = new THREE.CanvasTexture(c)
    gradient.minFilter = THREE.NearestFilter
    gradient.magFilter = THREE.NearestFilter
    gradient.generateMipmaps = false
  }
  return gradient
}

const toons = new Map()
export function toonMat(color) {
  if (!toons.has(color)) toons.set(color, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() }))
  return toons.get(color)
}

const basics = new Map()
export function basicMat(color) {
  if (!basics.has(color)) basics.set(color, new THREE.MeshBasicMaterial({ color }))
  return basics.get(color)
}

// garis tepi: salinan mesh yang sedikit membesar, hanya sisi dalamnya yang digambar
export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })
