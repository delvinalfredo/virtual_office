import { useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mergedToonMat, OUTLINE_MAT } from './toon'

// Menggabungkan semua mesh toon dan garis tepi di bawah `root` menjadi dua mesh (satu draw call masing-masing).
// Mesh aslinya hanya disembunyikan, bukan dihapus, supaya React tetap mengelolanya dan bisa dipulihkan.
// Cocok untuk kelompok yang bergerak sebagai satu benda kaku (perabot, satu lengan, satu kepala); mesh yang
// harus bergerak sendiri (mata yang berkedip) dibiarkan terpisah karena bahannya bukan toon.
// Mengembalikan fungsi pembersih yang memulihkan keadaan semula.
function bake(root) {
  root.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const rel = new THREE.Matrix4()
  const parts = { toon: [], hull: [] }
  const hidden = []

  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return
    const mat = o.material
    const kind = mat === OUTLINE_MAT ? 'hull' : mat?.isMeshToonMaterial && !mat.transparent && mat.emissive.getHex() === 0 ? 'toon' : null
    if (!kind) return
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    g.applyMatrix4(rel.multiplyMatrices(inv, o.matrixWorld))
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    if (kind === 'toon') {
      const n = g.attributes.position.count
      const c = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    }
    parts[kind].push({ g, o })
    hidden.push(o)
  })

  const made = []
  for (const kind of ['toon', 'hull']) {
    const list = parts[kind]
    if (!list.length) continue
    const geo = mergeGeometries(list.map((x) => x.g), false)
    if (!geo) continue
    const mesh = new THREE.Mesh(geo, kind === 'toon' ? mergedToonMat() : OUTLINE_MAT)
    mesh.castShadow = kind === 'toon' && list.some((x) => x.o.castShadow)
    mesh.receiveShadow = kind === 'toon' && list.some((x) => x.o.receiveShadow)
    root.add(mesh)
    made.push(mesh)
  }
  // kalau penggabungan gagal, mesh asli tetap terlihat
  if (!made.length) return () => {}
  for (const o of hidden) o.visible = false
  return () => {
    for (const m of made) { root.remove(m); m.geometry.dispose() }
    for (const o of hidden) o.visible = true
  }
}

// Bungkus kelompok yang kaku. Ubah `version` untuk memicu penggabungan ulang bila isinya berubah bentuk
// (misalnya alis dan mulut saat karakter mulai bekerja).
export function Merged({ version = 0, children }) {
  const ref = useRef()
  useLayoutEffect(() => bake(ref.current), [version])
  return <group ref={ref}>{children}</group>
}
