import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from './props'
import { damp } from './motion'
import { crowd } from './crowd'

const WOOD = '#b98558'
const KNOB = '#ffd23f'
const tmp = new THREE.Vector3()

// Pintu dua daun yang menutup celah di (x, z), lebar celah 2 * half, membuka ke dalam ruangan (arah -z).
// Daun membuka bila ada karakter (pemain atau agent) dalam jarak `reach` dari tengah celah, lalu menutup lagi.
// Kotak tabrakan di office-plan.js tetap di posisi terbuka: karakter sudah sampai di pintu setelah daunnya membuka.
function Doorway({ x, z, half, reach = 2 }) {
  const left = useRef()
  const right = useRef()
  const k = useRef(0)
  useFrame((_, rawDt) => {
    let near = false
    for (const o of crowd) {
      o.getWorldPosition(tmp)
      if (Math.hypot(tmp.x - x, tmp.z - z) < reach) { near = true; break }
    }
    k.current = damp(k.current, near ? 1 : 0, 7, Math.min(rawDt, 0.05))
    // 1,5 rad, tidak sampai 90 derajat supaya daun tidak menempel rata di kotak tabraknya
    left.current.rotation.y = k.current * 1.5
    right.current.rotation.y = -k.current * 1.5
  })
  const len = half - 0.04
  return (
    <group position={[x, 0, z]}>
      <group ref={left} position={[-(half - 0.02), 0, 0]}>
        <Box size={[len, 2, 0.06]} pos={[len / 2, 1, 0]} color={WOOD} />
        <Box size={[0.1, 0.1, 0.1]} pos={[len - 0.1, 1, 0.06]} color={KNOB} ink={0} />
      </group>
      <group ref={right} position={[half - 0.02, 0, 0]}>
        <Box size={[len, 2, 0.06]} pos={[-len / 2, 1, 0]} color={WOOD} />
        <Box size={[0.1, 0.1, 0.1]} pos={[-(len - 0.1), 1, 0.06]} color={KNOB} ink={0} />
      </group>
    </group>
  )
}

export default function Doors() {
  return (
    <>
      <Doorway x={0} z={-5} half={1.2} />
      <Doorway x={-9} z={-7.6} half={1} />
    </>
  )
}
