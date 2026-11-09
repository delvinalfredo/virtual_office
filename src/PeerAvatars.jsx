import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import Humanoid from './Humanoid'

// avatar pemain lain: humanoid abu dengan nama tamu; walk = bergerak (delta)
function Peer({ name, target }) {
  const group = useRef()
  const [walking, setWalking] = useState(false)
  useFrame((_, dt) => {
    if (!group.current) return
    const dx = (target.x ?? 0) - group.current.position.x
    const dz = (target.z ?? 0) - group.current.position.z
    group.current.position.x += dx * Math.min(1, dt * 8)
    group.current.position.z += dz * Math.min(1, dt * 8)
    // bergerak kalau masih jauh dari target (server update 250ms → lag kecil normal)
    const moving = Math.hypot(dx, dz) > 0.15
    if (moving !== walking.current) setWalking(moving)
    if (moving) {
      let tRot = Math.atan2(dx, dz)
      let d = tRot - group.current.rotation.y
      if (d > Math.PI) d -= Math.PI * 2
      if (d < -Math.PI) d += Math.PI * 2
      group.current.rotation.y += d * Math.min(1, dt * 10)
    }
  })
  return (
    <group ref={group} position={[target.x ?? 0, 0, target.z ?? 0]}>
      <Humanoid id={name} walk={walking.current} />
      <Billboard position={[0, 2.5, 0]}>
        <Text fontSize={0.2} color="#aef" anchorX="center" outlineWidth={0.025} outlineColor="#000">
          {name}
        </Text>
      </Billboard>
    </group>
  )
}

export default function PeerAvatars({ peers }) {
  return (
    <group>
      {peers.map((p) => (
        <Peer key={p.name} name={p.name} target={{ x: p.x, z: p.z }} />
      ))}
    </group>
  )
}
