// Material toon (cartoon) + outline helper — dipakai semua komponen
// MeshToonMaterial + gradient map prosedural 3 step supaya ada cel-shading band
import { useMemo } from 'react'
import * as THREE from 'three'

export function useToonGradient() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4; c.height = 1
    const g = c.getContext('2d')
    // 3 langkah: gelap, medium, terang
    g.fillStyle = '#555555'; g.fillRect(0, 0, 1, 1)
    g.fillStyle = '#999999'; g.fillRect(1, 0, 1, 1)
    g.fillStyle = '#ffffff'; g.fillRect(2, 0, 2, 1)
    const tex = new THREE.CanvasTexture(c)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    return tex
  }, [])
}

// mesh toon siap pakai: <Toon color="#f00" position=..>geometry</Toon>
export function Toon({ color = '#ffffff', gradient, children, ...props }) {
  return (
    <mesh {...props}>
      {children}
      <meshToonMaterial color={color} gradientMap={gradient} />
    </mesh>
  )
}

// outline sederhana: duplikat mesh dengan BackSide material gelap
export function Outline({ color = '#1a1a1a', thickness = 1.04, children, ...props }) {
  return (
    <mesh {...props} scale={thickness}>
      {children}
      <meshBasicMaterial color={color} side={THREE.BackSide} />
    </mesh>
  )
}
