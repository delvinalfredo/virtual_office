import { useEffect, useState } from 'react'
import { WALL, OBSTACLES, resolveObstacles, clampToRoom } from './office-plan'
import { sample } from './interp'

const SIZE = 140 // px, harus sama dengan lebar .minimap di index.css

// minimap 2D kanan-bawah: klik untuk teleport player
export function Minimap({ playerRef, agents = [], onTeleport }) {
  const [dots, setDots] = useState([])
  const [player, setPlayer] = useState({ x: 0, z: 6 })

  useEffect(() => {
    const iv = setInterval(() => {
      // posisi player dibaca dari ref (hindari re-render tiap frame)
      if (playerRef?.current) setPlayer({ x: playerRef.current.x, z: playerRef.current.z })
      // posisi dari interpolasi: state React tidak lagi diperbarui tiap paket posisi
      setDots(agents.map((a) => { const p = sample('agent', a.id) ?? a; return { id: a.id, x: p.x, z: p.z, state: a.state } }))
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
    <div className="minimap panel" onClick={click} title="Klik untuk teleport" role="img" aria-label="Peta kantor, klik untuk pindah">
      {OBSTACLES.map(([cx, cz, hw, hz], i) => (
        <div key={i} className="o" style={{
          left: toPx(cx - hw), top: toPx(cz - hz),
          width: toPx(cx + hw) - toPx(cx - hw), height: toPx(cz + hz) - toPx(cz - hz),
        }} />
      ))}
      {dots.map((d) => (
        <div key={d.id} className={`dot ${d.state}`} title={d.id} style={{ left: toPx(d.x), top: toPx(d.z) }} />
      ))}
      <div className="dot me" style={{ left: toPx(player.x), top: toPx(player.z) }} />
    </div>
  )
}
