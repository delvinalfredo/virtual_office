import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboard } from './useKeyboard'
import { clampToRoom, resolveObstacles, portalCheck } from './office-plan'
import { sfx } from './sfx'
import { damp, dampAngle } from './motion'
import Humanoid from './Humanoid'

const SPEED = 5

export function Player({ onPos = null, teleportRef = null }) {
  const keys = useKeyboard()
  const group = useRef()
  const pos = useRef(new THREE.Vector3(0, 0, 6))
  const vel = useRef({ x: 0, z: 0 }) // kecepatan sekarang: naik dan turun perlahan, bukan loncat ke SPEED
  const { camera } = useThree()

  // restore posisi terakhir dari localStorage
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('kantor-pos'))
      if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) {
        pos.current.set(s.x, 0, s.z)
      }
    } catch { /* penyimpanan kosong atau diblokir: mulai dari titik awal */ }
    camera.position.set(pos.current.x, 6, pos.current.z + 9)
  }, [camera])

  // teleport callback untuk minimap/portal
  useEffect(() => {
    if (teleportRef) {
      teleportRef.current = ({ x, z }) => {
        pos.current.set(x, 0, z)
        vel.current.x = 0
        vel.current.z = 0
        camera.position.set(x, 6, z + 9)
      }
    }
  }, [camera, teleportRef])

  const level = useRef(0) // 0 = lantai, 1 = rooftop
  const zoom = useRef(9) // jarak kamera dgn scroll
  const yaw = useRef(0) // arah pandang kamera (rad); Q/E rotasi

  useEffect(() => {
    const onWheel = (e) => {
      zoom.current = Math.max(4, Math.min(22, zoom.current + e.deltaY * 0.01))
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // rotasi kamera Q/E, gerakan pemain relatif ke arah kamera
    if (keys.has('q')) yaw.current += dt * 1.8
    if (keys.has('e')) yaw.current -= dt * 1.8

    const sinY = Math.sin(yaw.current), cosY = Math.cos(yaw.current)
    let mx = 0, mz = 0
    if (keys.has('w')) { mx -= sinY; mz -= cosY }
    if (keys.has('s')) { mx += sinY; mz += cosY }
    if (keys.has('a')) { mx -= cosY; mz += sinY }
    if (keys.has('d')) { mx += cosY; mz -= sinY }
    const len = Math.hypot(mx, mz)
    const wantX = len > 0.001 ? (mx / len) * SPEED : 0
    const wantZ = len > 0.001 ? (mz / len) * SPEED : 0
    // tahan tombol: cepat sampai kecepatan penuh; lepas: berhenti dalam sekejap tapi tidak mendadak
    const rate = len > 0.001 ? 14 : 18
    vel.current.x = damp(vel.current.x, wantX, rate, dt)
    vel.current.z = damp(vel.current.z, wantZ, rate, dt)
    pos.current.x += vel.current.x * dt
    pos.current.z += vel.current.z * dt

    clampToRoom(pos.current)
    resolveObstacles(pos.current, 0.45, level.current)
    const newLevel = portalCheck(pos.current, level.current)
    if (newLevel != null) {
      level.current = newLevel
      vel.current.x = 0
      vel.current.z = 0
      group.current.position.copy(pos.current)
      camera.position.set(pos.current.x, 6 + (newLevel ? 3 : 0), pos.current.z + 9)
      sfx.pop()
    }

    // hadap arah gerak; diam: tetap di arah terakhir
    if (Math.hypot(vel.current.x, vel.current.z) > 0.4) {
      group.current.rotation.y = dampAngle(group.current.rotation.y, Math.atan2(vel.current.x, vel.current.z), 14, dt)
    }
    const y = level.current === 1 ? 3.18 : 0
    group.current.position.set(pos.current.x, y, pos.current.z)
    const z = zoom.current
    const camY = z * 0.66 + (level.current === 1 ? 3 : 0)
    camera.position.lerp(
      new THREE.Vector3(pos.current.x + Math.sin(yaw.current) * z, camY, pos.current.z + Math.cos(yaw.current) * z),
      1 - Math.pow(0.001, dt)
    )
    camera.lookAt(pos.current.x, y + 1, pos.current.z)
  })

  // simpan posisi + kirim ke server tiap 100 ms: cukup rapat supaya pemain lain melihat gerak yang mulus
  useEffect(() => {
    const iv = setInterval(() => {
      const p = { x: pos.current.x, z: pos.current.z, level: level.current }
      try { localStorage.setItem('kantor-pos', JSON.stringify(p)) } catch { /* abaikan */ }
      onPos?.(p)
    }, 100)
    return () => clearInterval(iv)
  }, [onPos])

  return (
    <group ref={group} position={[0, 0, 6]}>
      <Humanoid id="kamu" />
    </group>
  )
}
