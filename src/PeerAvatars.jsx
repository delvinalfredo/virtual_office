import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import Humanoid from './Humanoid'
import { dampAngle } from './motion'
import { sample } from './interp'

// avatar pemain lain: posisi dari interpolasi (src/interp.js), jadi geraknya konstan walau paket tiba tidak rata;
// langkah kaki dihitung Humanoid dari gerakan itu
function Peer({ name, fallback }) {
  const group = useRef()
  const motion = useRef({ speed: 0 })
  const [start] = useState(() => { const p = sample('peer', name); return [p?.x ?? fallback.x, 0, p?.z ?? fallback.z] })
  useFrame((_, rawDt) => {
    const g = group.current
    const p = sample('peer', name)
    if (!g || !p) return
    const dt = Math.min(rawDt, 0.05)
    motion.current.speed = p.v
    const dx = p.x - g.position.x
    const dz = p.z - g.position.z
    // arah hadap dari gerak antar frame; terlalu kecil berarti diam, jangan diputar-putar oleh derau
    if (Math.hypot(dx, dz) > 0.004) g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dx, dz), 12, dt)
    g.position.x = p.x
    g.position.z = p.z
  })
  return (
    <group ref={group} position={start}>
      <Humanoid id={name} motion={motion} />
    </group>
  )
}

export default function PeerAvatars({ peers }) {
  return (
    <group>
      {peers.map((p) => (
        <Peer key={p.name} name={p.name} fallback={{ x: p.x, z: p.z }} />
      ))}
    </group>
  )
}
