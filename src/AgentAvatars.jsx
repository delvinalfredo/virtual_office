import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Humanoid from './Humanoid'
import Burst from './Burst'
import { ChatBubble } from './ChatBubble'
import { damp, dampAngle } from './motion'

// Teks bubble yang berarti "pekerjaan selesai": 'Disetujui' dari lead simulasi, 'Selesai' dari agen
// nyata (hook Claude Code). Harus sama dengan APPROVED dan DONE di server/index.js.
const DONE_BUBBLES = ['Disetujui', 'Selesai']

// avatar agent: Humanoid + posisi dari server (dihaluskan). Agen simulasi bisa diklik untuk DM;
// agen nyata (live) tidak bisa, dan tampilannya mengikuti tipe subagent, bukan id-nya.
function AgentAvatar({ id, look, label, target, heading, state, bubble, onClick }) {
  const group = useRef()
  const live = look !== undefined
  // tinggi bubble tetap per agen (dari id), tiga tingkat
  const lift = live ? [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 3 * 0.55 : 0
  // task selesai: konfeti di tempat agent berdiri.
  // Pola "bandingkan dengan nilai sebelumnya saat render" dipakai supaya tidak perlu efek.
  const [prevBubble, setPrevBubble] = useState(bubble)
  const [burstKey, setBurstKey] = useState(0)
  if (bubble !== prevBubble) {
    setPrevBubble(bubble)
    if (DONE_BUBBLES.includes(bubble)) setBurstKey((k) => k + 1)
  }

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    g.position.x = damp(g.position.x, target.x, 10, dt)
    g.position.z = damp(g.position.z, target.z, 10, dt)
    g.rotation.y = dampAngle(g.rotation.y, heading ?? 0, 10, dt)
  })

  return (
    <group
      ref={group}
      position={[target.x, 0, target.z]}
      onClick={live ? undefined : (e) => { e.stopPropagation(); onClick?.(id) }}
      onPointerOver={live ? undefined : () => { document.body.style.cursor = 'pointer' }}
      onPointerOut={live ? undefined : () => { document.body.style.cursor = 'auto' }}
    >
      <Humanoid id={look ?? id} label={label} working={state === 'working'} />
      {state === 'working' && !live && (
        <Html position={[0.7, 1.85, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
          <div className="say work">sedang kerja</div>
        </Html>
      )}
      {bubble && (state !== 'working' || live) && <ChatBubble text={bubble} lift={lift} />}
      {burstKey > 0 && <Burst key={burstKey} />}
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
      {agents.filter((a) => a.live).map((a) => (
        <AgentAvatar
          key={a.id}
          id={a.id}
          look={a.look}
          label={a.label}
          target={{ x: a.x, z: a.z }}
          heading={a.heading}
          state={a.state}
          bubble={a.bubble}
        />
      ))}
    </group>
  )
}
