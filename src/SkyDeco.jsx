import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonMat, OUTLINE_MAT } from './toon'
import { CLOUD } from './theme3d'

const PUFF = new THREE.SphereGeometry(1, 16, 12)

// tiap awan: beberapa bola putih bergaris tepi, [x, y, z, radius] relatif ke pusat awan
const SHAPES = [
  [[0, 0, 0, 2.2], [2.1, -0.3, 0.2, 1.7], [-2.0, -0.4, 0, 1.6], [0.6, 0.9, 0, 1.5]],
  [[0, 0, 0, 1.8], [1.8, -0.2, 0, 1.4], [-1.7, -0.3, 0.2, 1.3]],
  [[0, 0, 0, 2.5], [2.6, -0.5, 0, 1.9], [-2.4, -0.4, 0, 1.8], [-0.4, 1.1, 0.3, 1.6], [1.4, 0.8, 0, 1.3]],
]
const SPOTS = [
  [0, 17, 0], [1, 20, 0.7], [2, 15, 1.4], [0, 22, 2.1], [1, 16, 2.8], [2, 19, 3.5], [0, 14, 4.2], [1, 21, 4.9], [2, 18, 5.6],
]
const RING = 38

// Awan melayang pelan mengelilingi kantor, jauh di atas dan di luar dinding.
export default function SkyDeco() {
  const ring = useRef()
  useFrame((_, dt) => { ring.current.rotation.y += Math.min(dt, 0.05) * 0.012 })
  return (
    <group ref={ring}>
      {SPOTS.map(([shape, y, ang], i) => (
        <group key={i} position={[Math.sin(ang) * RING, y, Math.cos(ang) * RING]} rotation={[0, ang, 0]}>
          {SHAPES[shape].map(([x, py, z, r], j) => (
            <mesh key={j} geometry={PUFF} material={toonMat(CLOUD)} position={[x, py, z]} scale={r}>
              <mesh geometry={PUFF} material={OUTLINE_MAT} scale={1.05} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
