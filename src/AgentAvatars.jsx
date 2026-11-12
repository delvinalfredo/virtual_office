import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import Humanoid from './Humanoid'
import Burst from './Burst'
import { dampAngle } from './motion'
import { sample } from './interp'

// Teks bubble yang berarti "pekerjaan selesai": 'Disetujui' dari lead simulasi, 'Selesai' dari anggota tim yang
// mewakili sesi Claude Code. Harus sama dengan APPROVED dan DONE di server/index.js.
const DONE_BUBBLES = ['Disetujui', 'Selesai']

// avatar agent tim: Humanoid + posisi dari server (dihaluskan), bisa diklik untuk DM. Tanpa bubble di kepala:
// aktivitasnya tertulis di bagian Tim, dan teks bubble dari server hanya dibaca untuk memicu konfeti.
// pose dari server: 'sit' duduk (meja, meeting, sofa, toilet, makan), 'game' duduk main konsol, 'play' berdiri main
// (arcade, pingpong).
function AgentAvatar({ id, fallback, state, bubble, pose, onClick }) {
  const group = useRef()
  // posisi awal sekali saja (dari interpolasi bila sudah ada); sesudahnya digerakkan per frame di bawah
  const [start] = useState(() => { const p = sample('agent', id); return [p?.x ?? fallback.x, 0, p?.z ?? fallback.z] })
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
    const p = sample('agent', id)
    if (!g || !p) return
    // posisi hasil interpolasi: langsung dipakai, tanpa dikejar lagi (sudah halus); hanya arah hadap diperhalus
    g.position.x = p.x
    g.position.z = p.z
    g.rotation.y = dampAngle(g.rotation.y, p.h, 14, Math.min(rawDt, 0.05))
  })

  return (
    <group
      ref={group}
      position={start}
      onClick={(e) => { e.stopPropagation(); onClick?.(id) }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <Humanoid id={id} working={state === 'working' || pose === 'play' || pose === 'game'} sitting={pose === 'sit' || pose === 'game'} />
      {burstKey > 0 && <Burst key={burstKey} />}
    </group>
  )
}

export default function AgentAvatars({ agents, agentsStatic, onAgentClick }) {
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents])
  return (
    <group>
      {agentsStatic.map((s) => {
        const rt = byId[s.id] ?? { state: 'idle' }
        return (
          <AgentAvatar
            key={s.id}
            id={s.id}
            fallback={{ x: s.desk_x, z: s.desk_z }}
            state={rt.state}
            bubble={rt.bubble}
            pose={rt.pose}
            onClick={onAgentClick}
          />
        )
      })}
    </group>
  )
}
