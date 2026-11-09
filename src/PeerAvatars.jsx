import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import Humanoid from './Humanoid'

// avatar pemain lain: humanoid abu dengan nama tamu
function Peer({ name, target }) {
  const group = useRef()
  useFrame((_, dt) => {
    if (!group.current) return
    group.current.position.x += ((target.x ?? 0) - group.current.position.x) * Math.min(1, dt * 8)
    group.current.position.z += ((target.z ?? 0) - group.current.position.z) * Math.min(1, dt * 8)
  })
  return (
    <group ref={group} position={[target.x ?? 0, 0, target.z ?? 0]}>
      <Humanoid id={name} />
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
