import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import Humanoid from './Humanoid'
import { damp, dampAngle } from './motion'

// avatar pemain lain: mengikuti posisi dari server (dihaluskan); langkah kaki dihitung Humanoid dari gerakannya
function Peer({ name, target }) {
  const group = useRef()
  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const dx = target.x - g.position.x
    const dz = target.z - g.position.z
    g.position.x = damp(g.position.x, target.x, 10, dt)
    g.position.z = damp(g.position.z, target.z, 10, dt)
    // rooftop ada di y 3,18 (sama dengan Player), jadi pemain di atas tidak terlihat jalan di lantai bawah
    g.position.y = damp(g.position.y, target.level === 1 ? 3.18 : 0, 8, dt)
    if (Math.hypot(dx, dz) > 0.12) g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dx, dz), 10, dt)
  })
  return (
    <group ref={group} position={[target.x ?? 0, target.level === 1 ? 3.18 : 0, target.z ?? 0]}>
      <Humanoid id={name} />
    </group>
  )
}

export default function PeerAvatars({ peers }) {
  return (
    <group>
      {peers.map((p) => (
        <Peer key={p.name} name={p.name} target={{ x: p.x, z: p.z, level: p.level }} />
      ))}
    </group>
  )
}
