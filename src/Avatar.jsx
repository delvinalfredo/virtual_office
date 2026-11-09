import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from './useKeyboard'
import { clampToRoom, resolveObstacles, portalCheck } from './office-plan'
import { useToonGradient } from './toon'
import { sfx } from './sfx'
import Humanoid from './Humanoid'

const WALL = 12
const SPEED = 5

// role → warna baju, aksesori, label
export const ROLES = {
  kamu: { body: '#f39c12', label: 'Kamu' },
  programmer: { body: '#3b78c3', label: 'Programmer' },
  designer: { body: '#8e44ad', label: 'Designer', accessory: 'beret', accent: '#27ae60' },
  qa: { body: '#16a085', label: 'QA', accessory: 'cap', accent: '#1a1a1a' },
  pm: { body: '#ecf0f1', label: 'PM', accessory: 'tie', accent: '#d64545' },
  lead: { body: '#2c3e50', label: 'Tech Lead', accessory: 'headphones', accent: '#111' },
}

function Accessory({ type, color }) {
  if (type === 'cap') {
    return (
      <group>
        <mesh position={[0, 1.68, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.28, 0.12, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 1.63, 0.28]} castShadow>
          <boxGeometry args={[0.3, 0.04, 0.22]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    )
  }
  if (type === 'beret') {
    return (
      <mesh position={[0, 1.62, 0]} scale={[1, 0.45, 1]} castShadow>
        <sphereGeometry args={[0.3, 20, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )
  }
  if (type === 'tie') {
    return (
      <mesh position={[0, 0.85, 0.3]} castShadow>
        <boxGeometry args={[0.12, 0.45, 0.03]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )
  }
  if (type === 'headphones') {
    return (
      <group>
        <mesh position={[0, 1.45, 0]}>
          <torusGeometry args={[0.3, 0.035, 12, 24, Math.PI]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 1.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.06, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
        ))}
      </group>
    )
  }
  return null
}

// clipboard yang dibawa PM
function Clipboard() {
  return (
    <group position={[0.42, 0.9, 0.28]} rotation={[-0.5, 0, 0.3]}>
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.42, 0.03]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0, 0.02, 0.02]}>
        <boxGeometry args={[0.26, 0.34, 0.01]} />
        <meshStandardMaterial color="#fdfdfd" />
      </mesh>
    </group>
  )
}

// chibi: kepala besar, badan kecil, outline komik
function Body({ roleKey, walk }) {
  const role = ROLES[roleKey]
  const lArm = useRef()
  const rArm = useRef()
  const phase = useRef(Math.random() * Math.PI * 2)
  const gradient = useToonGradient()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phase.current
    if (walk) {
      const a = Math.sin(t * 10) * 0.5
      if (lArm.current) lArm.current.rotation.x = a
      if (rArm.current) rArm.current.rotation.x = -a
    } else {
      const a = Math.sin(t * 2) * 0.05
      if (lArm.current) lArm.current.rotation.x = 0.15 + a
      if (rArm.current) rArm.current.rotation.x = 0.15 - a
    }
  })

  return (
    <group>
      {/* outline badan */}
      <mesh position={[0, 0.55, 0]} scale={1.08}>
        <capsuleGeometry args={[0.3, 0.4, 8, 16]} />
        <meshBasicMaterial color="#261f33" side={THREE.BackSide} />
      </mesh>
      {/* badan chibi */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.4, 8, 16]} />
        <meshToonMaterial color={role.body} gradientMap={gradient} />
      </mesh>
      {/* lengan chibi */}
      {[-1, 1].map((s, i) => (
        <mesh
          key={s}
          ref={i === 0 ? lArm : rArm}
          position={[s * 0.36, 0.68, 0.02]}
          rotation={[0.15, 0, s * 0.35]}
          castShadow
        >
          <capsuleGeometry args={[0.085, 0.3, 4, 8]} />
          <meshToonMaterial color={role.body} gradientMap={gradient} />
        </mesh>
      ))}
      {/* outline kepala besar */}
      <mesh position={[0, 1.35, 0]} scale={1.09}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color="#261f33" side={THREE.BackSide} />
      </mesh>
      {/* kepala chibi */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshToonMaterial color="#ffe0b8" gradientMap={gradient} />
      </mesh>
      {/* mata gede komik */}
      {[-0.14, 0.14].map((x) => (
        <group key={x} position={[x, 1.42, 0.35]}>
          <mesh>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#2b2233" />
          </mesh>
        </group>
      ))}
      {/* blushing pipi */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={x} position={[x, 1.32, 0.3]} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ff9d9d" transparent opacity={0.7} />
        </mesh>
      ))}
      <Accessory type={role.accessory} color={role.accent} />
      {roleKey === 'pm' && <Clipboard />}
      {/* nama — selalu menghadap kamera */}
      <Billboard position={[0, 2.3, 0]}>
        <Text fontSize={0.32} color="#fff" anchorX="center" outlineWidth={0.03} outlineColor="#000">
          {role.label}
        </Text>
      </Billboard>
    </group>
  )
}

export function Player({ onPos = null, teleportRef = null }) {
  const keys = useKeyboard()
  const group = useRef()
  const pos = useRef(new THREE.Vector3(0, 0, 6))
  const { camera } = useThree()
  const walking = useRef(false)

  // restore posisi terakhir dari localStorage
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('kantor-pos'))
      if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) {
        pos.current.set(s.x, 0, s.z)
      }
    } catch {}
    camera.position.set(pos.current.x, 6, pos.current.z + 9)
  }, [camera])

  // teleport callback untuk minimap/portal
  useEffect(() => {
    if (teleportRef) {
      teleportRef.current = ({ x, z }) => {
        pos.current.set(x, 0, z)
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

  useFrame((_, dt) => {
    // rotasi kamera Q/E — gerakan pemain relatif ke arah kamera
    if (keys.has('q')) yaw.current += dt * 1.8
    if (keys.has('e')) yaw.current -= dt * 1.8

    const prev = pos.current.clone()
    // arah maju/kiri dalam ruang layar
    const sinY = Math.sin(yaw.current), cosY = Math.cos(yaw.current)
    let mx = 0, mz = 0
    if (keys.has('w')) { mx -= sinY; mz -= cosY }
    if (keys.has('s')) { mx += sinY; mz += cosY }
    if (keys.has('a')) { mx -= cosY; mz += sinY }
    if (keys.has('d')) { mx += cosY; mz -= sinY }
    const len = Math.hypot(mx, mz)
    if (len > 0.001) {
      pos.current.x += (mx / len) * SPEED * dt
      pos.current.z += (mz / len) * SPEED * dt
    }
    clampToRoom(pos.current)
    resolveObstacles(pos.current, 0.45, level.current)
    const newLevel = portalCheck(pos.current, level.current)
    if (newLevel != null) {
      level.current = newLevel
      group.current.position.copy(pos.current)
      camera.position.set(pos.current.x, 6 + (newLevel ? 3 : 0), pos.current.z + 9)
      sfx.pop()
    }

    walking.current = len > 0.001
    if (len > 0.001) {
      group.current.rotation.y = Math.atan2(mx, mz)
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

  // simpan posisi + broadcast ke server tiap 250ms
  useEffect(() => {
    const iv = setInterval(() => {
      const p = { x: pos.current.x, z: pos.current.z, level: level.current }
      localStorage.setItem('kantor-pos', JSON.stringify(p))
      onPos?.(p)
    }, 250)
    return () => clearInterval(iv)
  }, [onPos])

  return (
    <group ref={group} position={[0, 0, 6]}>
      <Humanoid id="kamu" walk={walking.current} />
    </group>
  )
}

export function Npc({ roleKey, position, rotationY = 0, walk = false }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Body roleKey={roleKey} walk={walk} />
    </group>
  )
}
