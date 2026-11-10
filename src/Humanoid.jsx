import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { toonMat, basicMat, OUTLINE_MAT } from './toon'
import { lookFor, INK } from './looks'
import { damp } from './motion'

// Geometri dibuat sekali dan dipakai semua karakter.
const sphere = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h)
const G = {
  head: sphere(0.4, 28, 22),
  torso: new THREE.CapsuleGeometry(0.25, 0.1, 6, 16),
  arm: new THREE.CapsuleGeometry(0.07, 0.2, 4, 10),
  hand: sphere(0.08, 12, 10),
  leg: new THREE.CapsuleGeometry(0.09, 0.22, 4, 10),
  shoe: new THREE.BoxGeometry(0.2, 0.12, 0.32),
  ear: sphere(0.07, 10, 8),
  eyeWhite: sphere(0.1, 14, 12),
  iris: sphere(0.068, 12, 10),
  pupil: sphere(0.036, 10, 8),
  glint: sphere(0.02, 8, 6),
  cheek: sphere(0.06, 10, 8),
  brow: new THREE.BoxGeometry(0.13, 0.026, 0.02),
  smile: new THREE.TorusGeometry(0.06, 0.014, 8, 14, Math.PI),
  flat: new THREE.BoxGeometry(0.1, 0.02, 0.02),
  hairCap: new THREE.SphereGeometry(0.425, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.5),
  puff: sphere(0.15, 12, 10),
  spike: new THREE.ConeGeometry(0.1, 0.3, 6),
  blob: sphere(0.42, 16, 12),
  bun: sphere(0.16, 12, 10),
  ring: new THREE.TorusGeometry(0.075, 0.012, 6, 16),
  bridge: new THREE.BoxGeometry(0.08, 0.012, 0.012),
  beret: sphere(0.3, 16, 10),
  capDome: new THREE.SphereGeometry(0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  brim: new THREE.BoxGeometry(0.42, 0.04, 0.26),
  band: new THREE.TorusGeometry(0.45, 0.03, 8, 24, Math.PI),
  cup: new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14),
  stubble: sphere(0.3, 14, 10),
  scarfRing: new THREE.TorusGeometry(0.2, 0.06, 8, 18),
  scarfTail: new THREE.BoxGeometry(0.1, 0.3, 0.04),
}

// bagian bertekstur toon + garis tepi. outline 0 = tanpa garis (benda kecil / tipis).
function Part({ geo, color, outline = 1.1, shadow = false, ...rest }) {
  return (
    <mesh geometry={geo} material={toonMat(color)} castShadow={shadow} {...rest}>
      {outline > 0 && <mesh geometry={geo} material={OUTLINE_MAT} scale={outline} />}
    </mesh>
  )
}

// rambut dilihat dari kepala (titik tengah kepala = 0,0,0). Topi alas dimiringkan ke belakang
// supaya dahi dan alis tetap terlihat.
function Hair({ style, color }) {
  const cap = <Part geo={G.hairCap} color={color} outline={1.06} position={[0, 0.02, -0.01]} rotation={[-0.55, 0, 0]} />
  const fringe = [-0.16, 0, 0.16].map((x) => (
    <Part key={x} geo={G.puff} color={color} outline={1.08} position={[x, 0.27, 0.3]} scale={[1, 0.6, 0.6]} />
  ))
  switch (style) {
    case 'spiky':
      return (
        <group>
          {cap}
          {[-2, -1, 0, 1, 2].map((k) => (
            <Part key={k} geo={G.spike} color={color} outline={1.08}
              position={[k * 0.14, 0.43 - Math.abs(k) * 0.05, -0.02]} rotation={[-0.1, 0, -k * 0.3]} />
          ))}
          <Part geo={G.spike} color={color} outline={1.08} position={[0.05, 0.36, 0.28]} rotation={[0.9, 0, -0.2]} scale={0.7} />
        </group>
      )
    case 'messy':
      return (
        <group>
          {cap}
          <Part geo={G.puff} color={color} outline={1.08} position={[-0.2, 0.34, 0.1]} scale={[1, 0.8, 0.9]} />
          <Part geo={G.puff} color={color} outline={1.08} position={[0.18, 0.37, -0.05]} />
          <Part geo={G.puff} color={color} outline={1.08} position={[0.02, 0.42, 0.14]} scale={0.8} />
          <Part geo={G.spike} color={color} outline={1.08} position={[-0.05, 0.28, 0.3]} rotation={[1.1, 0, 0.3]} scale={0.6} />
        </group>
      )
    case 'curly':
      return (
        <group>
          {cap}
          {[[0, 0.4, 0], [-0.25, 0.3, 0.06], [0.25, 0.3, 0.06], [-0.3, 0.1, -0.12], [0.3, 0.1, -0.12], [0, 0.22, -0.32], [0, 0.4, 0.2]].map(([x, y, z], i) => (
            <Part key={i} geo={G.puff} color={color} outline={1.08} position={[x, y, z]} />
          ))}
        </group>
      )
    case 'bob':
    case 'long':
      return (
        <group>
          {cap}
          {fringe}
          <Part geo={G.blob} color={color} outline={1.05} position={[0, style === 'long' ? -0.25 : -0.05, -0.3]}
            scale={style === 'long' ? [0.9, 1.25, 0.5] : [1, 0.8, 0.55]} />
        </group>
      )
    case 'bun':
      return (
        <group>
          {cap}
          {fringe}
          <Part geo={G.bun} color={color} outline={1.08} position={[0, 0.42, -0.18]} />
        </group>
      )
    case 'swept':
      return (
        <group>
          {cap}
          <Part geo={G.puff} color={color} outline={1.08} position={[0.12, 0.34, 0.2]} rotation={[0, 0, -0.3]} scale={[1.4, 0.6, 0.7]} />
        </group>
      )
    default:
      return <group>{cap}{fringe}</group>
  }
}

function Gear({ gear, hair }) {
  return (
    <group>
      {gear.includes('glasses') && (
        <group position={[0, 0.03, 0.385]}>
          {[-0.15, 0.15].map((x) => <Part key={x} geo={G.ring} color={INK} outline={0} position={[x, 0, 0]} scale={1.15} />)}
          <Part geo={G.bridge} color={INK} outline={0} />
        </group>
      )}
      {gear.includes('beret') && (
        <group>
          <Part geo={G.beret} color="#ef476f" outline={1.07} position={[0.04, 0.4, -0.02]} rotation={[0, 0, 0.2]} scale={[1, 0.38, 1]} />
          <Part geo={G.bun} color="#ef476f" outline={1.1} position={[0.06, 0.52, -0.02]} scale={0.4} />
        </group>
      )}
      {gear.includes('cap') && (
        <group>
          <Part geo={G.capDome} color="#ffd23f" outline={1.05} position={[0, 0.03, -0.01]} rotation={[-0.45, 0, 0]} />
          <Part geo={G.brim} color="#ffd23f" outline={1.1} position={[0, 0.22, 0.4]} rotation={[0.25, 0, 0]} />
        </group>
      )}
      {gear.includes('headphones') && (
        <group>
          <Part geo={G.band} color={INK} outline={0} position={[0, 0, 0]} />
          {[-0.45, 0.45].map((x) => <Part key={x} geo={G.cup} color="#ef476f" outline={1.1} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} />)}
        </group>
      )}
      {gear.includes('beard') && (
        <Part geo={G.stubble} color={hair} outline={0} position={[0, -0.27, 0.16]} scale={[1, 0.5, 0.55]} />
      )}
    </group>
  )
}

const BLINK = 0.14

// Karakter chibi. Gerak dihitung dari jarak yang benar-benar ditempuh grup induknya, jadi langkah
// selalu pas dengan kecepatan dan berhenti perlahan, di mana pun komponen ini dipasang.
export default function Humanoid({ id = 'kamu', label, working = false, heightScale = 1 }) {
  const look = lookFor(id)
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const eyeL = useRef()
  const eyeR = useRef()
  const s = useRef({ amp: 0, work: 0, phase: 0, has: false, px: 0, pz: 0, blinkAt: 0, off: 0 })
  const wp = useRef(new THREE.Vector3())

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const m = s.current
    root.current.getWorldPosition(wp.current)
    if (!m.has) {
      // nilai acak diambil di frame pertama: tiap karakter bernapas dan berkedip tidak serempak
      m.px = wp.current.x
      m.pz = wp.current.z
      m.off = Math.random() * 6
      m.blinkAt = 1 + Math.random() * 3
      m.has = true
    }
    const dist = Math.hypot(wp.current.x - m.px, wp.current.z - m.pz)
    m.px = wp.current.x
    m.pz = wp.current.z
    // lonjakan (teleport ke rooftop) bukan berjalan
    const speed = dt > 0 && dist / dt < 14 ? dist / dt : 0
    const moving = speed > 0.35
    m.amp = damp(m.amp, moving ? Math.min(1, speed / 3) : 0, moving ? 10 : 8, dt)
    if (moving) m.phase += dist * 4.2
    m.work = damp(m.work, working ? 1 : 0, 8, dt)

    const t = state.clock.elapsedTime + m.off
    const sw = Math.sin(m.phase) * m.amp
    const idle = 1 - m.amp

    legL.current.rotation.x = sw * 0.9
    legR.current.rotation.x = -sw * 0.9
    const type = Math.sin(t * 14) * 0.07
    const swing = 0.8 * sw
    const rest = Math.sin(t * 2) * 0.04 * idle
    armL.current.rotation.x = THREE.MathUtils.lerp(-swing + rest, -1.0 + type, m.work)
    armR.current.rotation.x = THREE.MathUtils.lerp(swing - rest, -1.0 - type, m.work)

    body.current.position.y = Math.abs(Math.cos(m.phase)) * 0.07 * m.amp + Math.sin(t * 2) * 0.01 * idle
    body.current.rotation.x = 0.1 * m.amp + 0.05 * m.work
    body.current.rotation.z = Math.sin(m.phase) * 0.04 * m.amp

    head.current.rotation.x = 0.16 * m.work
    head.current.rotation.y = Math.sin(t * 0.6) * 0.25 * idle * (1 - m.work)
    head.current.rotation.z = Math.sin(t * 0.9) * 0.04 * idle

    const b = t - m.blinkAt
    let open = 1
    if (b >= 0 && b < BLINK) open = 1 - Math.sin((b / BLINK) * Math.PI) * 0.9
    else if (b >= BLINK) m.blinkAt = t + 2 + Math.random() * 3
    eyeL.current.scale.y = open
    eyeR.current.scale.y = open
  })

  // label baru dipasang setelah render pertama selesai: Html milik drei yang dipasang pada render
  // awal Canvas (hanya terjadi pada Player) tidak pernah muncul di DOM
  const [tagOn, setTagOn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTagOn(true), 0)
    return () => clearTimeout(t)
  }, [])

  const browTilt = working ? 0.32 : 0.12

  return (
    <group ref={root} scale={heightScale}>
      <group ref={body}>
        {/* kaki dan sepatu, berayun dari pinggul */}
        {[-1, 1].map((sd) => (
          <group key={sd} ref={sd < 0 ? legR : legL} position={[sd * 0.13, 0.52, 0]}>
            <Part geo={G.leg} color={look.pants} position={[0, -0.2, 0]} shadow />
            <Part geo={G.shoe} color={look.shoes} position={[0, -0.46, 0.05]} outline={1.12} />
          </group>
        ))}

        <Part geo={G.torso} color={look.shirt} position={[0, 0.76, 0]} scale={[1, 1, 0.86]} shadow />
        {look.gear.includes('scarf') && (
          <group position={[0, 1.04, 0]}>
            <Part geo={G.scarfRing} color="#ef476f" outline={1.08} rotation={[Math.PI / 2, 0, 0]} />
            <Part geo={G.scarfTail} color="#ef476f" outline={1.1} position={[0.1, -0.2, 0.2]} rotation={[0, 0, 0.12]} />
          </group>
        )}

        {/* lengan berayun dari bahu */}
        {[-1, 1].map((sd) => (
          <group key={sd} ref={sd < 0 ? armR : armL} position={[sd * 0.32, 0.98, 0]}>
            <Part geo={G.arm} color={look.shirt} position={[0, -0.17, 0]} rotation={[0, 0, sd * 0.12]} shadow />
            <Part geo={G.hand} color={look.skin} position={[sd * 0.04, -0.38, 0]} />
          </group>
        ))}

        <group ref={head} position={[0, 1.42, 0]}>
          <Part geo={G.head} color={look.skin} scale={[1, 0.94, 0.96]} shadow />
          {[-1, 1].map((sd) => <Part key={sd} geo={G.ear} color={look.skin} outline={1.15} position={[sd * 0.4, -0.02, 0]} scale={[0.6, 1, 0.8]} />)}

          {/* mata besar: putih, iris, pupil, kilau. Kedip lewat skala y */}
          {[-1, 1].map((sd) => (
            <group key={sd} ref={sd < 0 ? eyeL : eyeR} position={[sd * 0.15, 0.03, 0.33]}>
              <mesh geometry={G.eyeWhite} material={basicMat('#ffffff')} scale={[1, 1.25, 0.5]} />
              <mesh geometry={G.iris} material={basicMat(look.eye)} position={[0, 0, 0.04]} scale={[1, 1.25, 0.5]} />
              <mesh geometry={G.pupil} material={basicMat(INK)} position={[0, 0, 0.06]} scale={[1, 1.25, 0.5]} />
              <mesh geometry={G.glint} material={basicMat('#ffffff')} position={[sd * -0.025, 0.05, 0.08]} />
            </group>
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={G.cheek} material={basicMat('#ff9fb0')} position={[sd * 0.26, -0.08, 0.29]} scale={[1, 0.6, 0.4]} />
          ))}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={G.brow} material={toonMat(look.hair)} position={[sd * 0.15, 0.2, 0.34]} rotation={[0, 0, -sd * browTilt]} />
          ))}
          {working
            ? <mesh geometry={G.flat} material={basicMat(INK)} position={[0, -0.15, 0.36]} />
            : <mesh geometry={G.smile} material={basicMat(INK)} position={[0, -0.12, 0.36]} rotation={[0, 0, Math.PI]} />}

          <Hair style={look.hairStyle} color={look.hair} />
          <Gear gear={look.gear} hair={look.hair} />
        </group>
      </group>

      {tagOn && (
        <Html position={[0, 2.25, 0]} center zIndexRange={[5, 0]} pointerEvents="none">
          <div className="ntag" style={{ '--tag': look.tag }}>{label ?? look.label}</div>
        </Html>
      )}
    </group>
  )
}
