import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { basicMat } from './toon'

const PIECE = new THREE.BoxGeometry(0.1, 0.1, 0.1)
const RING = new THREE.RingGeometry(0.3, 0.4, 36).rotateX(-Math.PI / 2)
const COLORS = ['#ffd23f', '#ef476f', '#3a86ff', '#06a77d', '#ffffff']
const COUNT = 16
const LIFE = 1.1

// Konfeti kecil dan cincin yang melebar. Pasang dengan `key` baru untuk memutar ulang;
// setelah sekitar satu detik semuanya disembunyikan. Dilewati kalau pengguna meminta gerak dikurangi.
export default function Burst() {
  const group = useRef()
  const ring = useRef()
  const m = useRef({ age: 0, parts: null })
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useFrame((_, dt) => {
    const b = m.current
    if (calm || b.age > LIFE) { group.current.visible = false; ring.current.visible = false; return }
    // arah acak diambil di frame pertama, bukan saat render
    b.parts ??= Array.from({ length: COUNT }, () => {
      const a = Math.random() * Math.PI * 2
      const sp = 0.8 + Math.random() * 1.4
      return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2.2 + Math.random() * 2, spin: Math.random() * 8 }
    })
    b.age += Math.min(dt, 0.05)
    const t = b.age
    group.current.children.forEach((c, i) => {
      const p = b.parts[i]
      c.position.set(p.vx * t, 1.2 + p.vy * t - 5 * t * t, p.vz * t)
      c.rotation.set(p.spin * t, p.spin * t, 0)
      c.scale.setScalar(Math.max(0.01, 1 - t * t * 0.8))
    })
    const e = Math.min(1, t / 0.6)
    ring.current.scale.setScalar(1 + e * 2.4)
    ring.current.material.opacity = 0.8 * (1 - e)
  })

  return (
    <group>
      <group ref={group}>
        {Array.from({ length: COUNT }, (_, i) => <mesh key={i} geometry={PIECE} material={basicMat(COLORS[i % COLORS.length])} />)}
      </group>
      <mesh ref={ring} geometry={RING} position={[0, 0.06, 0]}>
        <meshBasicMaterial color="#ffd23f" transparent depthWrite={false} />
      </mesh>
    </group>
  )
}
