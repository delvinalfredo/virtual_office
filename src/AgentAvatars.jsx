import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import Humanoid from './Humanoid'
import { ChatBubble } from './ChatBubble'

// avatar agent: Humanoid + animasi state dari server, klik untuk DM
function AgentAvatar({ id, target, heading, state, bubble, onClick }) {
  const group = useRef()

  useFrame((_, dt) => {
    if (!group.current) return
    group.current.position.x += (target.x - group.current.position.x) * Math.min(1, dt * 8)
    group.current.position.z += (target.z - group.current.position.z) * Math.min(1, dt * 8)
    const targetRot = Math.atan2(Math.sin(heading ?? 0), Math.cos(heading ?? 0))
    let d = targetRot - group.current.rotation.y
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    group.current.rotation.y += d * Math.min(1, dt * 10)
  })

  return (
    <group
      ref={group}
      position={[target.x, 0, target.z]}
      onClick={(e) => { e.stopPropagation(); onClick?.(id) }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <Humanoid
        id={id}
        walk={state === 'walking'}
        working={state === 'working'}
      />
      {state === 'working' && (
        <Billboard position={[0.65, 1.75, 0]}>
          <Text fontSize={0.2} color="#2ecc71" anchorX="center" outlineWidth={0.02} outlineColor="#000">
            ⌨ kerja...
          </Text>
        </Billboard>
      )}
      {state !== 'working' && bubble && <ChatBubble text={bubble} />}
    </group>
  )
}

export default function AgentAvatars({ agents, agentsStatic, onAgentClick }) {
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents])
  return (
    <group>
      {agentsStatic.map((s) => {
        const rt = byId[s.id] ?? { x: s.desk_x, z: s.desk_z, state: 'idle', heading: 0 }
        return (
          <AgentAvatar
            key={s.id}
            id={s.id}
            target={{ x: rt.x, z: rt.z }}
            heading={rt.heading}
            state={rt.state}
            bubble={rt.bubble}
            onClick={onAgentClick}
          />
        )
      })}
    </group>
  )
}
