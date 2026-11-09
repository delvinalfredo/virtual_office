import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useToonGradient } from './toon'

// Palet per role: kulit, rambut, baju, celana, sepatu
const PALETTES = {
  kamu:       { skin: '#f6c9a0', hair: '#2b2118', shirt: '#f39c12', pants: '#34495e', shoes: '#2c2c2c', hairStyle: 'short' },
  prog1:      { skin: '#e8b48a', hair: '#3d2b1f', shirt: '#3b78c3', pants: '#2c3e50', shoes: '#1a1a1a', hairStyle: 'short', glasses: true },
  prog2:      { skin: '#f7d1ac', hair: '#111111', shirt: '#2e86de', pants: '#33393f', shoes: '#1a1a1a', hairStyle: 'curly', glasses: true },
  designer:   { skin: '#f6c9a0', hair: '#8b3a3a', shirt: '#8e44ad', pants: '#3d3d4e', shoes: '#584848', hairStyle: 'long' },
  qa:         { skin: '#dfae83', hair: '#1d1d1d', shirt: '#16a085', pants: '#2c3e50', shoes: '#222',  hairStyle: 'cap' },
  lead:       { skin: '#f2c194', hair: '#4a4a4a', shirt: '#2c3e50', pants: '#26333f', shoes: '#111',  hairStyle: 'headphonesBeard' },
  programmer: { skin: '#e8b48a', hair: '#3d2b1f', shirt: '#3b78c3', pants: '#2c3e50', shoes: '#1a1a1a', hairStyle: 'short', glasses: true },
  pm:         { skin: '#f6c9a0', hair: '#5b4027', shirt: '#ecf0f1', pants: '#2c3e50', shoes: '#52341f', hairStyle: 'sidepart', tie: true },
}

const LABELS = {
  kamu: 'Kamu', prog1: 'Programmer', prog2: 'Programmer 2', designer: 'Designer',
  qa: 'QA', lead: 'Tech Lead', programmer: 'Programmer', pm: 'PM',
}

function H({ x, y, z, s, rot = [0, 0, 0] }) {
  return [x, y, z, s, rot]
}

// gaun tubuh humanoid: 2 kaki + torso + 2 tangan + leher + kepala + rambut
export default function Humanoid({ id = 'kamu', walk = false, working = false, heightScale = 1 }) {
  const p = PALETTES[id] ?? PALETTES.kamu
  const gradient = useToonGradient()
  const lArm = useRef()
  const rArm = useRef()
  const lLeg = useRef()
  const rLeg = useRef()
  const head = useRef()
  const phase = useRef(Math.random() * Math.PI * 2)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + phase.current
    if (walk) {
      const a = Math.sin(t * 11) * 0.6
      if (lArm.current) lArm.current.rotation.x = a
      if (rArm.current) rArm.current.rotation.x = -a
      if (lLeg.current) lLeg.current.rotation.x = -a * 0.9
      if (rLeg.current) rLeg.current.rotation.x = a * 0.9
      if (head.current) head.current.position.y = 1.62 + Math.abs(Math.sin(t * 11)) * 0.02
    } else if (working) {
      // mengetik: kedua tangan ke depan
      const a = Math.sin(t * 14) * 0.07
      if (lArm.current) lArm.current.rotation.x = -0.9 + a
      if (rArm.current) rArm.current.rotation.x = -0.9 - a
      if (lLeg.current) lLeg.current.rotation.x = 0
      if (rLeg.current) rLeg.current.rotation.x = 0
      if (head.current) head.current.position.y = 1.62
    } else {
      const a = Math.sin(t * 2) * 0.05
      if (lArm.current) lArm.current.rotation.x = 0.08 + a
      if (rArm.current) rArm.current.rotation.x = 0.08 - a
      if (lLeg.current) lLeg.current.rotation.x = 0
      if (rLeg.current) rLeg.current.rotation.x = 0
      if (head.current) head.current.position.y = 1.62 + Math.sin(t * 1.6) * 0.012
    }
  })

  const skinMat = <meshToonMaterial color={p.skin} gradientMap={gradient} />
  const shirtMat = <meshToonMaterial color={p.shirt} gradientMap={gradient} />
  const pantsMat = <meshToonMaterial color={p.pants} gradientMap={gradient} />

  return (
    <group scale={heightScale}>
      {/* ——— kaki ——— */}
      {[[rLeg, -1], [lLeg, 1]].map(([ref, s]) => (
        <group key={s} ref={ref} position={[s * 0.12, 0.72, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.095, 0.42, 4, 10]} />
            {pantsMat}
          </mesh>
          {/* sepatu */}
          <mesh position={[0, -0.56, 0.06]} castShadow>
            <boxGeometry args={[0.17, 0.1, 0.3]} />
            <meshToonMaterial color={p.shoes} gradientMap={gradient} />
          </mesh>
        </group>
      ))}

      {/* ——— torso (baju) ——— */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <capsuleGeometry args={[0.21, 0.42, 6, 14]} />
        {shirtMat}
      </mesh>
      {/* kerah baju */}
      <mesh position={[0, 1.28, 0.02]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.13, 0.025, 8, 16]} />
        <meshToonMaterial color="#ffffff" gradientMap={gradient} />
      </mesh>
      {p.tie && (
        <mesh position={[0, 1.05, 0.2]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.07, 0.36, 0.02]} />
          <meshToonMaterial color="#d64545" gradientMap={gradient} />
        </mesh>
      )}

      {/* ——— lengan ——— */}
      {[[rArm, -1], [lArm, 1]].map(([ref, s]) => (
        <group key={s} ref={ref} position={[s * 0.27, 1.22, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.3, 4, 10]} />
            {shirtMat}
          </mesh>
          {/* tangan (kulit) */}
          <mesh position={[0, -0.38, 0]} castShadow>
            <sphereGeometry args={[0.07, 10, 10]} />
            {skinMat}
          </mesh>
        </group>
      ))}

      {/* ——— leher + kepala ——— */}
      <mesh position={[0, 1.36, 0]}>
        <cylinderGeometry args={[0.063, 0.07, 0.1, 10]} />
        {skinMat}
      </mesh>
      <group ref={head} position={[0, 1.62, 0]}>
        {/* tengkorak */}
        <mesh castShadow>
          <sphereGeometry args={[0.21, 24, 20]} />
          {skinMat}
        </mesh>
        {/* hidung */}
        <mesh position={[0, -0.02, 0.2]}>
          <coneGeometry args={[0.035, 0.08, 10]} rotation={[Math.PI / 2, 0, 0]} />
          {skinMat}
        </mesh>
        {/* mata: putih + pupil + highlight */}
        {[-0.08, 0.08].map((x) => (
          <group key={x} position={[x, 0.035, 0.165]}>
            <mesh scale={[1, 0.82, 0.7]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0, 0.032]} scale={[1, 0.82, 0.5]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshBasicMaterial color="#3b2a1e" />
            </mesh>
          </group>
        ))}
        {/* alis */}
        {[-0.08, 0.08].map((x) => (
          <mesh key={`b${x}`} position={[x, 0.1, 0.185]} rotation={[0, 0, x > 0 ? -0.15 : 0.15]}>
            <boxGeometry args={[0.065, 0.014, 0.01]} />
            <meshToonMaterial color={p.hair} gradientMap={gradient} />
          </mesh>
        ))}
        {/* mulut senyum */}
        <mesh position={[0, -0.09, 0.185]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.045, 0.011, 8, 12, Math.PI]} />
          <meshToonMaterial color="#b0564a" gradientMap={gradient} />
        </mesh>
        {/* telinga */}
        {[-0.2, 0.2].map((x) => (
          <mesh key={`e${x}`} position={[x, 0, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            {skinMat}
          </mesh>
        ))}

        {/* ——— rambut per gaya ——— */}
        {p.hairStyle === 'short' && (
          <mesh position={[0, 0.045, -0.01]} scale={[1.03, 0.9, 1.05]}>
            <sphereGeometry args={[0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshToonMaterial color={p.hair} gradientMap={gradient} />
          </mesh>
        )}
        {p.hairStyle === 'curly' && (
          <group>
            {[
              [0, 0.14, 0], [-0.13, 0.09, 0.06], [0.13, 0.09, 0.06],
              [-0.14, 0.06, -0.1], [0.14, 0.06, -0.1], [0, 0.1, -0.16],
            ].map(([x, y, z], i) => (
              <mesh key={i} position={[x, y, z]} castShadow>
                <sphereGeometry args={[0.095, 8, 8]} />
                <meshToonMaterial color={p.hair} gradientMap={gradient} />
              </mesh>
            ))}
          </group>
        )}
        {p.hairStyle === 'long' && (
          <group>
            <mesh position={[0, 0.045, -0.01]} scale={[1.04, 0.9, 1.06]}>
              <sphereGeometry args={[0.218, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshToonMaterial color={p.hair} gradientMap={gradient} />
            </mesh>
            {/* rambut jatuh belakang */}
            <mesh position={[0, -0.14, -0.12]} castShadow>
              <capsuleGeometry args={[0.14, 0.22, 4, 10]} />
              <meshToonMaterial color={p.hair} gradientMap={gradient} />
            </mesh>
          </group>
        )}
        {p.hairStyle === 'cap' && (
          <group>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshToonMaterial color="#1a1a1a" gradientMap={gradient} />
            </mesh>
            <mesh position={[0, 0.09, 0.2]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.28, 0.03, 0.16]} />
              <meshToonMaterial color="#1a1a1a" gradientMap={gradient} />
            </mesh>
          </group>
        )}
        {p.hairStyle === 'sidepart' && (
          <group>
            <mesh position={[0, 0.05, -0.02]} scale={[1.04, 0.85, 1.05]}>
              <sphereGeometry args={[0.216, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshToonMaterial color={p.hair} gradientMap={gradient} />
            </mesh>
            {/* sisir samping */}
            <mesh position={[-0.09, 0.14, 0.05]} rotation={[0, 0, -0.4]}>
              <boxGeometry args={[0.16, 0.02, 0.2]} />
              <meshToonMaterial color={p.hair} gradientMap={gradient} />
            </mesh>
          </group>
        )}
        {p.hairStyle === 'headphonesBeard' && (
          <group>
            <mesh position={[0, 0.05, -0.01]} scale={[1.02, 0.85, 1.02]}>
              <sphereGeometry args={[0.213, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshToonMaterial color={p.hair} gradientMap={gradient} />
            </mesh>
            {/* jenggot tipis */}
            <mesh position={[0, -0.13, 0.1]} scale={[1, 0.6, 0.5]}>
              <sphereGeometry args={[0.12, 10, 8]} />
              <meshToonMaterial color="#3d3d3d" gradientMap={gradient} />
            </mesh>
            {/* headphone */}
            <mesh position={[0, 0.08, 0]} rotation={[0.25, 0, 0]}>
              <torusGeometry args={[0.21, 0.02, 8, 20, Math.PI]} />
              <meshToonMaterial color="#111" gradientMap={gradient} />
            </mesh>
            {[-0.21, 0.21].map((x) => (
              <mesh key={x} position={[x, 0.05, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
                <meshToonMaterial color="#111" gradientMap={gradient} />
              </mesh>
            ))}
          </group>
        )}
        {p.glasses && (
          <group>
            {[-0.08, 0.08].map((x) => (
              <mesh key={x} position={[x, 0.035, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.05, 0.008, 6, 14]} />
                <meshToonMaterial color="#222" gradientMap={gradient} />
              </mesh>
            ))}
            <mesh position={[0, 0.035, 0.19]}>
              <boxGeometry args={[0.05, 0.006, 0.01]} />
              <meshToonMaterial color="#222" gradientMap={gradient} />
            </mesh>
          </group>
        )}
      </group>

      {/* label */}
      <Billboard position={[0, 2.25, 0]}>
        <Text fontSize={0.26} color="#fff" anchorX="center" outlineWidth={0.025} outlineColor="#000">
          {LABELS[id] ?? id}
        </Text>
      </Billboard>
    </group>
  )
}
