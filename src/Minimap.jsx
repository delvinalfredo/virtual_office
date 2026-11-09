import { useEffect, useState } from 'react'
import { WALL, OBSTACLES, resolveObstacles, clampToRoom } from './office-plan'

const SIZE = 140 // px

// minimap 2D kanan-bawah: klik untuk teleport player
export function Minimap({ playerRef, agents = [], onTeleport }) {
  const [dots, setDots] = useState([])
  const [player, setPlayer] = useState({ x: 0, z: 6 })

  useEffect(() => {
    const iv = setInterval(() => {
      // posisi player dibaca dari ref (hindari re-render tiap frame)
      if (playerRef?.current) setPlayer({ x: playerRef.current.x, z: playerRef.current.z })
      setDots(agents.map((a) => ({ id: a.id, x: a.x, z: a.z, state: a.state })))
    }, 250)
    return () => clearInterval(iv)
  }, [agents, playerRef])

  const toPx = (v) => ((v + WALL) / (2 * WALL)) * SIZE

  const click = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fx = ((e.clientX - rect.left) / rect.width) * 2 * WALL - WALL
    const fz = ((e.clientY - rect.top) / rect.height) * 2 * WALL - WALL
    // hindari titik dalam meja: tekan lewat resolveObstacles
    const p = { x: fx, z: fz }
    clampToRoom(p)
    resolveObstacles(p, 0.6)
    onTeleport({ x: p.x, z: p.z })
  }

  return (
    <div
      onClick={click}
      title="klik untuk teleport"
      style={{
        position: 'fixed', bottom: 70, right: 16, width: SIZE, height: SIZE,
        background: 'rgba(20,24,32,0.8)', borderRadius: 10, cursor: 'crosshair',
        border: '1px solid rgba(255,255,255,0.15)', zIndex: 20, overflow: 'hidden',
      }}
    >
      {/* meja */}
      {OBSTACLES.map(([cx, cz, hw, hz], i) => (
        <div key={i} style={{
          position: 'absolute',
          left: toPx(cx - hw), top: toPx(cz - hz),
          width: toPx(cx + hw) - toPx(cx - hw), height: toPx(cz + hz) - toPx(cz - hz),
          background: 'rgba(200,160,106,0.7)', borderRadius: 2,
        }} />
      ))}
      {/* agent */}
      {dots.map((d) => (
        <div key={d.id} title={d.id} style={{
          position: 'absolute',
          left: toPx(d.x) - 3, top: toPx(d.z) - 3,
          width: 6, height: 6, borderRadius: '50%',
          background: d.state === 'working' ? '#2ecc71' : d.state === 'walking' ? '#f39c12' : '#95a5a6',
        }} />
      ))}
      {/* kamu */}
      <div style={{
        position: 'absolute',
        left: toPx(player.x) - 4, top: toPx(player.z) - 4,
        width: 8, height: 8, borderRadius: '50%',
        background: '#e67e22', border: '1px solid #fff',
      }} />
    </div>
  )
}
