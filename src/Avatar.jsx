import { useRef, useEffect, useState, memo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboard } from './useKeyboard'
import { clampToRoom, resolveObstacles, PLAYER_SPOTS } from './office-plan'
import { damp, dampAngle } from './motion'
import Humanoid from './Humanoid'
import { Said } from './ChatBubble'

const SPEED = 5
const NEAR = 1.5 // jarak terjauh ke tempat yang bisa dipakai (tombol F)
const LABEL = { sit: 'duduk', game: 'main game', play: 'main' }

// said: chat terakhir pemain ini (dari App), tampil sebagai gelembung di atas kepala.
// free: kamera bebas (OrbitControls) yang memegang kamera; pemain tidak menariknya dan WASD mengikuti arah pandang.
// onHint: dipanggil dengan teks petunjuk tombol F (atau null) saat ada tempat pakai di dekat pemain atau saat sedang memakainya.
// Tombol F: duduk, main, atau berdiri di tempat terdekat (kursi, sofa, meja makan, pingpong, arcade, dan seterusnya);
// WASD melepaskannya. Pose dan arah hadap dikirim ke pemain lain lewat onPos.
function PlayerBase({ onPos = null, onHint = null, said = null, free = false }) {
  const keys = useKeyboard()
  const group = useRef()
  const pos = useRef(new THREE.Vector3(0, 0, 6))
  const vel = useRef({ x: 0, z: 0 }) // kecepatan sekarang: naik dan turun perlahan, bukan loncat ke SPEED
  const { camera } = useThree()
  const [pose, setPose] = useState(null) // pose di tempat yang sedang dipakai: sit, game, play, atau null
  const seat = useRef(null) // tempat yang sedang dipakai
  const near = useRef(null) // tempat terdekat yang bisa dipakai
  const hint = useRef(null)
  const say = (text) => { if (hint.current !== text) { hint.current = text; onHint?.(text) } }
  const leave = () => { seat.current = null; setPose(null) }

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

  const zoom = useRef(9) // jarak kamera dgn scroll
  const yaw = useRef(0) // arah pandang kamera (rad); Q/E rotasi

  useEffect(() => {
    const onWheel = (e) => {
      zoom.current = Math.max(4, Math.min(22, zoom.current + e.deltaY * 0.01))
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // F: duduk atau berdiri. Diabaikan saat mengetik di kolom isian.
  useEffect(() => {
    const kd = (e) => {
      if (e.key.toLowerCase() !== 'f' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
      if (seat.current) { seat.current = null; setPose(null) }
      else if (near.current) { seat.current = near.current; setPose(near.current.pose ?? null) }
    }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // jalan melepaskan tempat yang sedang dipakai
    if (seat.current && 'wasd'.split('').some((k) => keys.has(k))) leave()
    // rotasi kamera Q/E, gerakan pemain relatif ke arah kamera
    if (free) yaw.current = Math.atan2(camera.position.x - pos.current.x, camera.position.z - pos.current.z)
    else {
      if (keys.has('q')) yaw.current += dt * 1.8
      if (keys.has('e')) yaw.current -= dt * 1.8
    }

    if (seat.current) {
      // duduk atau berdiri di tempat: posisi dan arah hadap dikunci, tanpa tabrakan (tempatnya boleh di dalam kotak kursi)
      const s = seat.current
      pos.current.set(s.x, 0, s.z)
      vel.current.x = 0
      vel.current.z = 0
      group.current.rotation.y = dampAngle(group.current.rotation.y, s.h ?? group.current.rotation.y, 14, dt)
      group.current.position.set(s.x, 0, s.z)
      say('F atau WASD untuk berdiri')
    } else {
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
    resolveObstacles(pos.current, 0.45)

    // hadap arah gerak; diam: tetap di arah terakhir
    if (Math.hypot(vel.current.x, vel.current.z) > 0.4) {
      group.current.rotation.y = dampAngle(group.current.rotation.y, Math.atan2(vel.current.x, vel.current.z), 14, dt)
    }
    group.current.position.set(pos.current.x, 0, pos.current.z)

    // tempat pakai terdekat, untuk tombol F dan petunjuk di dok
    let best = null
    let bd = NEAR
    for (const sp of PLAYER_SPOTS) {
      const d = Math.hypot(sp.x - pos.current.x, sp.z - pos.current.z)
      if (d < bd) { bd = d; best = sp }
    }
    near.current = best
    say(best ? `F untuk ${LABEL[best.pose] ?? 'pakai'}` : null)
    }
    if (free) return
    const z = zoom.current
    const camY = z * 0.66
    camera.position.lerp(
      new THREE.Vector3(pos.current.x + Math.sin(yaw.current) * z, camY, pos.current.z + Math.cos(yaw.current) * z),
      1 - Math.pow(0.001, dt)
    )
    camera.lookAt(pos.current.x, 1, pos.current.z)
  })

  // kirim posisi ke server tiap 50 ms. Posisi dan cap waktunya diambil di saat yang sama, jadi timer yang
  // telat (frame berat) hanya membuat paket lebih jarang, tidak membuat gerak di layar orang lain miring.
  useEffect(() => {
    let n = 0
    const iv = setInterval(() => {
      const p = { x: pos.current.x, z: pos.current.z, t: performance.now(), pose: seat.current?.pose, h: seat.current?.h }
      if (n++ % 10 === 0) {
        try { localStorage.setItem('kantor-pos', JSON.stringify({ x: p.x, z: p.z })) } catch { /* abaikan */ }
      }
      onPos?.(p)
    }, 50)
    return () => clearInterval(iv)
  }, [onPos])

  return (
    <group ref={group} position={[0, 0, 6]}>
      <Humanoid id="kamu" working={pose === 'play' || pose === 'game'} sitting={pose === 'sit' || pose === 'game'} />
      <Said msg={said} />
    </group>
  )
}

// props hanya berubah saat pemain mengirim chat, jadi pemain tidak dirender ulang tiap kali server mengirim posisi agent
export const Player = memo(PlayerBase)
