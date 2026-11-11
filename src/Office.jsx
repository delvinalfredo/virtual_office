import { useRef, useLayoutEffect, memo } from 'react'
import * as THREE from 'three'
import { Box, Ink } from './props'
import { Merged } from './merge'
import { toonGradient } from './toon'
import { CLUSTER_X, SPINES, CHAIR_DZ } from './office-plan'

const WALL = 12

function Rug({ pos, size, color }) {
  return (
    <mesh position={[pos[0], 0.055, pos[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshToonMaterial color={color} gradientMap={toonGradient()} />
    </mesh>
  )
}

// ——— props komik tambahan ———
// pohon low-poly ala kartun
function CartoonTree({ x, z, scale = 1 }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 1.8, 8]} />
        <meshToonMaterial color="#8a5a33" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <dodecahedronGeometry args={[1.1, 0]} />
        <meshToonMaterial color="#3faa4e" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0.6, 2.9, 0.3]} castShadow>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshToonMaterial color="#4fc361" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[-0.5, 3.1, -0.2]} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshToonMaterial color="#35944a" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
    </group>
  )
}

// semak kecil
function Bush({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow scale={[1, 0.75, 1]}>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial color="#43b052" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
    </group>
  )
}

// lampu jalan
function StreetLamp({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 3.2, 8]} />
        <meshToonMaterial color="#37474f" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0, 3.3, 0.35]} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.32]} />
        <meshToonMaterial color="#37474f" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0, 3.22, 0.35]}>
        <boxGeometry args={[0.36, 0.05, 0.22]} />
        <meshBasicMaterial color="#fff176" />
      </mesh>
      <pointLight position={[0, 3.1, 0.35]} intensity={8} distance={7} color="#fff9c4" />
    </group>
  )
}

// vending machine: badan merah, isi kaleng warna-warni
function Vending({ x, z, rot = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[1, 2, 0.7]} pos={[0, 1, 0]} color="#d32f2f" />
      <Box size={[0.62, 1.1, 0.03]} pos={[-0.12, 1.25, 0.36]} color="#b2ebf2" />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[0.14, 0.2, 0.03]} pos={[-0.32 + i * 0.2, 1.55, 0.38]} color={['#8e24aa', '#fbc02d', '#388e3c'][i]} />
      ))}
      <Box size={[0.3, 0.42, 0.03]} pos={[0.25, 0.55, 0.36]} color="#263238" />
    </group>
  )
}

// mesin arcade
function Arcade({ x, z, rot = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[0.8, 1.7, 0.7]} pos={[0, 0.85, 0]} color="#7b1fa2" />
      <Box size={[0.55, 0.4, 0.05]} pos={[0, 1.35, 0.36]} color="#80deea" />
      <Box size={[0.6, 0.12, 0.4]} pos={[0, 1.05, 0.35]} color="#4a148c" />
      <Box size={[0.5, 0.06, 0.4]} pos={[0, 1.72, 0.2]} color="#4a148c" />
    </group>
  )
}

// Papan lantai kayu: 576 papan dengan warna sedikit berbeda, digambar sebagai satu mesh instansi
// (satu draw call). Sebelumnya tiap papan satu mesh sehingga lantai saja memakai ratusan draw call.
const FLOOR_N = 24
const FLOOR_COLORS = ['#d9a05b', '#d2954e', '#cf9450', '#d8a660', '#c98f45']
function WoodFloor() {
  const ref = useRef()
  useLayoutEffect(() => {
    const step = (2 * WALL) / FLOOR_N
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    const m = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const one = new THREE.Vector3(1, 1, 1)
    const col = new THREE.Color()
    for (let i = 0; i < FLOOR_N; i++) {
      for (let j = 0; j < FLOOR_N; j++) {
        const k = i * FLOOR_N + j
        pos.set(-WALL + (j + 0.5) * step, 0.03 + (i % 2) * 0.001, -WALL + (i + 0.5) * step)
        ref.current.setMatrixAt(k, m.compose(pos, q, one))
        ref.current.setColorAt(k, col.set(FLOOR_COLORS[(i + j) % 5]))
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <group>
      {/* dasar tanah di bawah papan, supaya celah tidak memperlihatkan rumput */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * WALL, 2 * WALL]} />
        <meshStandardMaterial color="#c98f45" />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, FLOOR_N * FLOOR_N]} receiveShadow frustumCulled={false}>
        <planeGeometry args={[(2 * WALL) / FLOOR_N - 0.04, (2 * WALL) / FLOOR_N - 0.02]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}

// Satu meja kerja ala kantor: papan meja menempel ke meja sebelah, sekat setinggi 1,3 m di kiri dan kanan.
// Lokal: pengguna duduk di sisi +z, sekat tengah (spine) di sisi -z. Meja sisi utara diputar 180 derajat.
// Panel samping dipasang oleh Cluster (dipakai bersama dua meja bertetangga), bukan di sini.
function Workstation({ x, z, north, mug }) {
  return (
    <group position={[x, 0, z]} rotation={[0, north ? Math.PI : 0, 0]}>
      <Box size={[1.76, 0.07, 0.9]} pos={[0, 0.75, 0]} color="#d7b98a" />
      <Box size={[0.5, 0.5, 0.7]} pos={[0.55, 0.36, 0]} color="#b9bfc9" />
      {/* monitor, keyboard, mug */}
      <Box size={[0.6, 0.38, 0.04]} pos={[-0.1, 1.15, -0.25]} color="#aee3f7" />
      <Box size={[0.05, 0.22, 0.05]} pos={[-0.1, 0.9, -0.25]} color="#5a5a5a" />
      <Box size={[0.3, 0.03, 0.18]} pos={[-0.1, 0.8, -0.25]} color="#5a5a5a" />
      <Box size={[0.45, 0.03, 0.16]} pos={[-0.1, 0.8, 0.12]} color="#e8e8e8" />
      <Box size={[0.12, 0.12, 0.12]} pos={[0.65, 0.85, 0.1]} color={mug} />
    </group>
  )
}

const MUGS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71']
const PANEL = '#8aa0c0'

// Dua baris meja saling membelakangi di satu garis sekat tengah, tiga meja per baris. Pasangan ini satu
// kotak tabrakan di office-plan.js (CLUSTERS); kursi ada di luar kotaknya, 1,25 dari sekat.
function Cluster({ cx, s, seed }) {
  const xs = [-1, 0, 1].map((k) => cx + k * 1.8)
  const edges = [-2.7, -0.9, 0.9, 2.7].map((d) => cx + d)
  return (
    <group>
      <Box size={[5.4, 1.3, 0.06]} pos={[cx, 0.65, s]} color={PANEL} />
      {[-0.5, 0.5].flatMap((dz) => edges.map((ex) => (
        <Box key={`${dz}${ex}`} size={[0.05, 1.3, 0.9]} pos={[ex, 0.65, s + dz]} color={PANEL} />
      )))}
      {xs.map((x, i) => (
        <group key={x}>
          <Workstation x={x} z={s - 0.5} north mug={MUGS[(seed + i) % 4]} />
          <Workstation x={x} z={s + 0.5} north={false} mug={MUGS[(seed + i + 2) % 4]} />
          <Chair x={x} z={s - CHAIR_DZ} color="#3a4a63" />
          <Chair x={x} z={s + CHAIR_DZ} rot={Math.PI} color="#3a4a63" />
        </group>
      ))}
    </group>
  )
}

function Chair({ x, z, rot = 0, color = '#e67e22' }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[0.5, 0.08, 0.5]} pos={[0, 0.45, 0]} color={color} />
      <Box size={[0.5, 0.55, 0.08]} pos={[0, 0.73, -0.21]} color={color} />
      <Box size={[0.08, 0.45, 0.08]} pos={[0, 0.22, 0]} color="#555" />
    </group>
  )
}

function MeetingTable() {
  return (
    <group position={[0, 0, -8.5]}>
      <Box size={[4, 0.15, 2]} pos={[0, 0.75, 0]} color="#f5e6c8" />
      <Box size={[0.2, 0.75, 0.2]} pos={[-1.6, 0.37, 0]} color="#c9a86a" />
      <Box size={[0.2, 0.75, 0.2]} pos={[1.6, 0.37, 0]} color="#c9a86a" />
      {/* karpet memenuhi seluruh ruangan (x -5 sampai 5, z -12 sampai -5; dinding setebal 0,2 jadi 9,8 x 6,8) */}
      <Rug pos={[0, 0, 0]} size={[9.8, 6.8]} color="#c0392b" />
      {/* papan tulis + frame, menempel di tembok belakang (z dunia -11,85; permukaan tembok di -11,9).
          Puncaknya 2,45, di bawah puncak tembok 2,6. */}
      <Box size={[3, 1.5, 0.08]} pos={[0, 1.6, -3.35]} color="#fdfdfd" />
      <Box size={[3.2, 1.7, 0.04]} pos={[0, 1.6, -3.37]} color="#8d6e63" />
      {/* tissues / properti kecil di meja */}
      <Box size={[0.3, 0.2, 0.3]} pos={[0, 0.95, 0]} color="#ecf0f1" />
      <Chair x={-1.6} z={-1.3} color="#8e44ad" />
      <Chair x={1.6} z={-1.3} color="#8e44ad" />
      <Chair x={-1.6} z={1.3} rot={Math.PI} color="#8e44ad" />
      <Chair x={1.6} z={1.3} rot={Math.PI} color="#8e44ad" />
      {/* kursi samping menghadap ke meja: kiri ke +x, kanan ke -x */}
      {[-2.6, 2.6].map((x, i) => (
        <Chair key={`cside${i}`} x={x} z={0} rot={x < 0 ? Math.PI / 2 : -Math.PI / 2} color="#8e44ad" />
      ))}
    </group>
  )
}

// kursi santai satu orang, menghadap +z (selatan) seperti sofa
function Armchair({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[0.9, 0.45, 0.9]} pos={[0, 0.22, 0]} color="#3a86ff" />
      <Box size={[0.9, 0.6, 0.2]} pos={[0, 0.55, -0.35]} color="#3a86ff" />
      <Box size={[0.15, 0.35, 0.9]} pos={[-0.5, 0.4, 0]} color="#2b64c8" />
      <Box size={[0.15, 0.35, 0.9]} pos={[0.5, 0.4, 0]} color="#2b64c8" />
    </group>
  )
}

function Sofa({ x, z, rot = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[2.2, 0.5, 0.9]} pos={[0, 0.25, 0]} color="#e17055" />
      <Box size={[2.2, 0.6, 0.25]} pos={[0, 0.55, -0.33]} color="#e17055" />
      <Box size={[0.25, 0.35, 0.9]} pos={[-1.05, 0.4, 0]} color="#d35f45" />
      <Box size={[0.25, 0.35, 0.9]} pos={[1.05, 0.4, 0]} color="#d35f45" />
    </group>
  )
}

function Pingpong({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[2.4, 0.1, 1.4]} pos={[0, 0.76, 0]} color="#2e6d4f" />
      <Box size={[0.12, 0.76, 0.12]} pos={[-1, 0.38, 0]} color="#355e3b" />
      <Box size={[0.12, 0.76, 0.12]} pos={[1, 0.38, 0]} color="#355e3b" />
      <Box size={[0.02, 0.14, 1.4]} pos={[0, 0.86, 0]} color="#fdfdfd" />
      <Box size={[0.2, 0.03, 0.26]} pos={[-1, 0.82, 0.3]} color="#e74c3c" />
      <Box size={[0.2, 0.03, 0.26]} pos={[1, 0.82, -0.3]} color="#3a86ff" />
      {/* net & bola */}
      <mesh position={[0.4, 0.9, 0.1]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshToonMaterial color="#fdfdfd" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
    </group>
  )
}

function Plant({ x, z, scale = 1 }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 16]} />
        <meshToonMaterial color="#b5651d" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial color="#27ae60" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      <mesh position={[0.18, 1.15, 0]} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshToonMaterial color="#2ecc71" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
    </group>
  )
}

// window di dinding belakang: kuaca kaca + frame putih
function Window({ x, y = 1.9, z = -WALL }) {
  const w = 2
  return (
    <group position={[x, y, z + 0.11]}>
      <Box size={[w, 1.4, 0.06]} pos={[0, 0, 0]} color="#bae3f2" />
      <Box size={[w + 0.12, 1.5, 0.05]} pos={[0, 0, -0.05]} color="#fdfdfd" />
      <Box size={[0.06, 1.4, 0.06]} pos={[0, 0, 0.03]} color="#fdfdfd" />
    </group>
  )
}

// Ruang meeting di tengah tembok belakang: dinding barat dan timur, dinding depan dengan pintu
// masuk 2,4 m (agent memakai titik koridor di depan dan di dalam pintu), dan TV di dinding timur.
// Kotak tabrakannya ada di office-plan.js.
function MeetingRoom() {
  return (
    <group>
      <Box size={[0.2, 2.6, 7]} pos={[-5, 1.3, -8.5]} color="#fcfcf7" />
      <Box size={[0.2, 2.6, 7]} pos={[5, 1.3, -8.5]} color="#fcfcf7" />
      <Box size={[3.8, 2.6, 0.2]} pos={[-3.1, 1.3, -5]} color="#fcfcf7" />
      <Box size={[3.8, 2.6, 0.2]} pos={[3.1, 1.3, -5]} color="#fcfcf7" />
      <Box size={[2.4, 0.5, 0.2]} pos={[0, 2.35, -5]} color="#fcfcf7" />
      {/* bingkai pintu kayu, dua daun terbuka ke dalam (tegak lurus dinding, di kiri dan kanan jalan masuk) */}
      <Box size={[0.12, 2.1, 0.28]} pos={[-1.26, 1.05, -5]} color={DOOR_WOOD} />
      <Box size={[0.12, 2.1, 0.28]} pos={[1.26, 1.05, -5]} color={DOOR_WOOD} />
      <Box size={[2.64, 0.12, 0.28]} pos={[0, 2.1, -5]} color={DOOR_WOOD} />
      <Box size={[0.06, 2.0, 1.2]} pos={[-1.14, 1.0, -5.7]} color="#b98558" />
      <Box size={[0.06, 2.0, 1.2]} pos={[1.14, 1.0, -5.7]} color="#b98558" />
      <Box size={[0.1, 0.1, 0.1]} pos={[-1.08, 1.0, -6.2]} color="#ffd23f" />
      <Box size={[0.1, 0.1, 0.1]} pos={[1.08, 1.0, -6.2]} color="#ffd23f" />
      <Box size={[1.6, 0.3, 0.06]} pos={[0, 2.38, -4.88]} color="#3a86ff" />
      <Box size={[0.1, 1.0, 1.9]} pos={[4.85, 1.7, -8.5]} color="#1c2233" />
      <Box size={[0.05, 0.84, 1.74]} pos={[4.8, 1.7, -8.5]} color="#2b3452" />
    </group>
  )
}

// TV lounge di tembok depan, menghadap sofa di depannya
function LoungeTV() {
  return (
    <group>
      <Box size={[3, 1.6, 0.14]} pos={[-8, 1.7, 11.8]} color="#1c2233" />
      <Box size={[2.8, 1.4, 0.06]} pos={[-8, 1.7, 11.7]} color="#2b3452" />
      <Box size={[0.9, 0.5, 0.04]} pos={[-8.7, 1.85, 11.66]} color="#ffd23f" />
      <Box size={[0.9, 0.5, 0.04]} pos={[-7.4, 1.55, 11.66]} color="#06a77d" />
      <Box size={[2, 0.5, 0.4]} pos={[-8, 0.25, 11.7]} color="#5b6b8c" />
      <Box size={[0.4, 0.1, 0.3]} pos={[-8.5, 0.55, 11.7]} color="#1c2233" />
    </group>
  )
}

// ruang makan: satu meja panjang dengan empat kursi (dua di tiap sisi panjang) dan piring. Kursi tidak jadi
// penghalang supaya agent bisa duduk; kursinya ada 0,6 dari tepi meja (lihat SPOTS.eat di server).
function Dining() {
  return (
    <group>
      <Box size={[3, 0.08, 1]} pos={[5, 0.75, 9.5]} color="#d7b98a" />
      <Box size={[0.12, 0.72, 0.8]} pos={[3.75, 0.36, 9.5]} color="#9a7748" />
      <Box size={[0.12, 0.72, 0.8]} pos={[6.25, 0.36, 9.5]} color="#9a7748" />
      {[4.2, 5.8].map((x) => (
        <group key={x}>
          <Chair x={x} z={8.4} color="#e67e22" />
          <Chair x={x} z={10.6} rot={Math.PI} color="#e67e22" />
          <Box size={[0.4, 0.03, 0.4]} pos={[x, 0.8, 9.2]} color="#fdfdfd" />
          <Box size={[0.4, 0.03, 0.4]} pos={[x, 0.8, 9.8]} color="#fdfdfd" />
        </group>
      ))}
      <Box size={[0.3, 0.18, 0.3]} pos={[5, 0.88, 9.5]} color="#ef476f" />
    </group>
  )
}

// TV tugas di tembok barat: empat kolom warna yang sama dengan papan Kanban (To Do, In Progress, Review, Done),
// agent berdiri di depannya untuk melihat papan. Hanya hiasan; isi sebenarnya ada di papan task.
function TaskTV() {
  const cols = ['#e0d2ff', '#ffd9a8', '#fff0a8', '#bdf2da']
  return (
    <group>
      <Box size={[0.14, 1.5, 2.7]} pos={[-11.8, 2.0, -1]} color="#1c2233" />
      <Box size={[0.06, 1.3, 2.5]} pos={[-11.7, 2.0, -1]} color="#2b3452" />
      {cols.map((c, i) => (
        <Box key={c} size={[0.04, 1.0, 0.5]} pos={[-11.66, 1.95, -1 + (i - 1.5) * 0.6]} color={c} />
      ))}
    </group>
  )
}

// pantry di tembok timur: meja counter, mesin kopi, mug, dan dispenser air
function Pantry() {
  return (
    <group>
      <Box size={[0.8, 0.95, 3]} pos={[11.5, 0.475, 4.5]} color="#e9e2d0" />
      <Box size={[0.9, 0.06, 3.1]} pos={[11.5, 0.98, 4.5]} color="#8d6e63" />
      <Box size={[0.4, 0.5, 0.4]} pos={[11.5, 1.28, 3.7]} color="#37474f" />
      <Box size={[0.1, 0.1, 0.1]} pos={[11.3, 1.1, 3.7]} color="#e74c3c" />
      <Box size={[0.1, 0.1, 0.1]} pos={[11.3, 1.1, 4.3]} color="#3498db" />
      <Box size={[0.45, 1.0, 0.45]} pos={[11.5, 0.5, 6.4]} color="#eceff1" />
      <Box size={[0.3, 0.4, 0.3]} pos={[11.5, 1.2, 6.4]} color="#a5d8ff" />
    </group>
  )
}

// sudut printer di tembok barat: meja kecil, printer, tumpukan kertas
function PrinterCorner() {
  return (
    <group>
      <Box size={[0.7, 0.8, 1.2]} pos={[-11.5, 0.4, 4]} color="#c8a06a" />
      <Box size={[0.5, 0.3, 0.6]} pos={[-11.5, 0.95, 4]} color="#e8e8e8" />
      <Box size={[0.3, 0.12, 0.25]} pos={[-11.5, 1.16, 4]} color="#fdfdfd" />
    </group>
  )
}

// kloset duduk: mangkuk, dudukan, tangki di belakang. Agent duduk tepat di titik ini (lihat SPOTS di server).
function Toilet({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.4, 14]} />
        <meshToonMaterial color="#fdfdfd" gradientMap={toonGradient()} />
        <Ink scale={1.06} />
      </mesh>
      <Box size={[0.6, 0.06, 0.64]} pos={[0, 0.43, 0.02]} color="#fdfdfd" />
      <Box size={[0.56, 0.6, 0.24]} pos={[0, 0.72, -0.34]} color="#e8eef2" />
      <Box size={[0.12, 0.05, 0.08]} pos={[0.16, 1.04, -0.34]} color="#9aa5ad" />
    </group>
  )
}

// toilet pojok barat laut: lantai ubin, dinding timur dan selatan dengan pintu, sekat, dua kloset, wastafel.
// Kotak tabrakannya ada di src/office-plan.js; agent masuk lewat pintunya (TOILET.door di server).
// warna dinding toilet sengaja bukan putih, supaya tidak menyatu dengan tembok luar kantor
const TOILET_WALL = '#f2b5c4'
const DOOR_WOOD = '#a9744a'

function ToiletRoom() {
  return (
    <group>
      <Rug pos={[-9.25, 0, -9.8]} size={[5.5, 4.4]} color="#d6ecf5" />
      <Box size={[0.2, 2.6, 4.4]} pos={[-6.5, 1.3, -9.8]} color={TOILET_WALL} />
      <Box size={[2, 2.6, 0.2]} pos={[-11, 1.3, -7.6]} color={TOILET_WALL} />
      <Box size={[1.5, 2.6, 0.2]} pos={[-7.25, 1.3, -7.6]} color={TOILET_WALL} />
      {/* pintu terbuka: bingkai kayu, daun pintu berengsel di sisi barat dan terbuka ke dalam (tegak lurus dinding,
          di luar jalur agent yang lewat di tengah celah) */}
      <Box size={[0.12, 2.1, 0.26]} pos={[-10.06, 1.05, -7.6]} color={DOOR_WOOD} />
      <Box size={[0.12, 2.1, 0.26]} pos={[-7.94, 1.05, -7.6]} color={DOOR_WOOD} />
      <Box size={[2.18, 0.12, 0.26]} pos={[-9, 2.16, -7.6]} color={DOOR_WOOD} />
      <Box size={[0.06, 2.0, 0.9]} pos={[-9.9, 1.0, -8.1]} color={DOOR_WOOD} />
      <Box size={[0.1, 0.1, 0.1]} pos={[-9.82, 1.0, -8.45]} color="#ffd23f" />
      {/* ambang pintu dan papan tanda biru */}
      <Box size={[2.2, 0.44, 0.2]} pos={[-9, 2.38, -7.6]} color={TOILET_WALL} />
      <Box size={[0.7, 0.4, 0.06]} pos={[-9, 2.35, -7.46]} color="#3a86ff" />
      <Box size={[0.12, 1.6, 2.2]} pos={[-9.2, 0.8, -10.9]} color="#bfe3f7" />
      <Toilet x={-10.6} z={-11.2} />
      <Toilet x={-7.8} z={-11.2} />
      {/* wastafel di dinding timur bagian dalam */}
      <Box size={[0.5, 0.08, 0.4]} pos={[-6.9, 0.85, -8.4]} color="#fdfdfd" />
      <Box size={[0.08, 0.3, 0.04]} pos={[-6.7, 1.0, -8.4]} color="#9aa5ad" />
      <Box size={[0.5, 0.5, 0.04]} pos={[-6.62, 1.6, -8.4]} color="#bae3f2" />
    </group>
  )
}

// rak buku warna warni di pojok
function Bookshelf({ x, z, rot = 0 }) {
  const bookColors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c']
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[1.6, 2, 0.4]} pos={[0, 1, 0]} color="#8d5524" />
      {[0, 1, 2].map((row) =>
        bookColors.slice(row, row + 5).map((c, i) => (
          <Box key={`${row}-${i}`} size={[0.14, 0.5, 0.25]} pos={[-0.6 + i * 0.3, 0.55 + row * 0.6, 0.1]} color={c} />
        ))
      )}
    </group>
  )
}

// semua benda diam digabung per jenis bahan oleh <Merged>, jadi seluruh kantor hanya beberapa draw call
function Office() {
  return (
    <Merged>
      <WoodFloor />

      {/* rumput di luar */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshToonMaterial color="#7ec850" gradientMap={toonGradient()} />
      </mesh>

      {/* jalan masuk setapak */}
      <mesh position={[0, -0.04, WALL + 2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 5]} />
        <meshToonMaterial color="#b8b8b0" gradientMap={toonGradient()} />
      </mesh>

      {/* pohon & semak di sekeliling kantor */}
      <CartoonTree x={-16} z={-14} scale={1.2} />
      <CartoonTree x={16} z={-13} />
      <CartoonTree x={-17} z={2} scale={0.9} />
      <CartoonTree x={17} z={4} scale={1.1} />
      <CartoonTree x={-14} z={14} />
      <CartoonTree x={13} z={15} scale={0.85} />
      <Bush x={-14} z={-10} />
      <Bush x={-15.5} z={-8} />
      <Bush x={15} z={-9} />
      <Bush x={-16} z={7} />
      <Bush x={16} z={9} />
      <Bush x={-13} z={12} />

      {/* lampu jalan */}
      <StreetLamp x={-4} z={16} />
      <StreetLamp x={5} z={16.5} />
      <StreetLamp x={-14} z={0} />
      <StreetLamp x={14.5} z={-2} />

      {/* vending & arcade menempel dinding kanan */}
      <Vending x={11.5} z={-4} rot={-Math.PI / 2} />
      <Vending x={11.5} z={-5.3} rot={-Math.PI / 2} />
      <Arcade x={11.5} z={-7} rot={-Math.PI / 2} />
      <Arcade x={11.5} z={-8} rot={-Math.PI / 2} />

      {/* dinding modern: pilar + panel kaca transparan, tinggi 2.6 */}
      {[
        [-WALL + 2, -WALL], [-WALL + 9, -WALL], [WALL - 2, -WALL], [WALL - 9, -WALL],
        [-WALL, -WALL + 2], [-WALL, -WALL + 9], [-WALL, WALL - 2], [-WALL, WALL - 9],
        [WALL, -WALL + 2], [WALL, -WALL + 9], [WALL, WALL - 2], [WALL, WALL - 9],
      ].map(([x, z], i) => (
        <Box key={`pil${i}`} size={[0.35, 2.6, 0.35]} pos={[x, 1.3, z]} color="#fcfcf7" />
      ))}
      {/* tembok putih penuh: belakang, kiri, kanan */}
      <Box size={[2 * WALL, 2.6, 0.2]} pos={[0, 1.3, -WALL]} color="#fcfcf7" />
      <Box size={[0.2, 2.6, 2 * WALL]} pos={[-WALL, 1.3, 0]} color="#fcfcf7" />
      <Box size={[0.2, 2.6, 2 * WALL]} pos={[WALL, 1.3, 0]} color="#fcfcf7" />
      {/* dinding depan: tembok tipis putih dengan pintu keluar di tengah. Pintunya tertutup; pemain memang
          tidak bisa keluar (clampToRoom), jadi pintu hanya penanda tempat tamu masuk. */}
      <Box size={[WALL - 1.4, 2.6, 0.2]} pos={[-(WALL + 1.4) / 2, 1.3, WALL]} color="#fcfcf7" />
      <Box size={[WALL - 1.4, 2.6, 0.2]} pos={[(WALL + 1.4) / 2, 1.3, WALL]} color="#fcfcf7" />
      <Box size={[2.8, 0.4, 0.2]} pos={[0, 2.4, WALL]} color="#fcfcf7" />
      <Box size={[0.14, 2.2, 0.28]} pos={[-1.34, 1.1, WALL]} color={DOOR_WOOD} />
      <Box size={[0.14, 2.2, 0.28]} pos={[1.34, 1.1, WALL]} color={DOOR_WOOD} />
      <Box size={[2.82, 0.14, 0.28]} pos={[0, 2.2, WALL]} color={DOOR_WOOD} />
      <Box size={[2.54, 2.1, 0.1]} pos={[0, 1.05, WALL]} color="#b98558" />
      <Box size={[0.04, 2.1, 0.12]} pos={[0, 1.05, WALL]} color={DOOR_WOOD} />
      <Box size={[0.1, 0.22, 0.14]} pos={[-0.18, 1.0, WALL - 0.08]} color="#ffd23f" />
      <Box size={[0.1, 0.22, 0.14]} pos={[0.18, 1.0, WALL - 0.08]} color="#ffd23f" />
      <Box size={[0.9, 0.3, 0.06]} pos={[0, 2.5, WALL - 0.12]} color="#06a77d" />

      <TaskTV />
      <Pantry />
      <PrinterCorner />

      {/* area kerja: dua kelompok, masing-masing dua pasang baris meja berpunggungan dengan sekat di tengah
          dan di antara meja. Karpet abu-abu seperti kantor pada umumnya. */}
      {CLUSTER_X.map((cx) => (
        <Rug key={`rug${cx}`} pos={[cx, 0, 2.5]} size={[6.2, 8.8]} color="#aab4c6" />
      ))}
      {CLUSTER_X.flatMap((cx, ci) => SPINES.map((s, si) => (
        <Cluster key={`cl${cx}${s}`} cx={cx} s={s} seed={ci * 2 + si} />
      )))}

      {/* rak kiri menempel dinding barat di sebelah toilet, bukunya menghadap ke ruangan */}
      <Bookshelf x={-11.7} z={-5.5} rot={Math.PI / 2} />
      <Bookshelf x={10.6} z={-11.65} rot={0} />
      <Bookshelf x={11.7} z={0} rot={-Math.PI / 2} />

      {/* tanaman di pojok, di depan ruang meeting, dan mengapit pintu depan */}
      <Plant x={-7.2} z={-6.8} scale={0.8} />
      <Plant x={-WALL + 1} z={WALL - 1} scale={0.8} />
      <Plant x={WALL - 1} z={-WALL + 1} />
      <Plant x={WALL - 1} z={WALL - 1} scale={0.8} />
      <Plant x={-5.8} z={-4.3} scale={0.8} />
      <Plant x={5.8} z={-4.3} scale={0.8} />
      <Plant x={8.8} z={-3} scale={0.7} />
      <Plant x={-2.2} z={WALL - 1} scale={0.9} />
      <Plant x={2.2} z={WALL - 1} scale={0.9} />

      <MeetingRoom />
      <MeetingTable />
      <ToiletRoom />

      {/* lounge barat daya: karpet, TV di tembok depan, sofa dan dua kursi santai menghadap TV dengan meja kopi di tengah */}
      <Rug pos={[-8, 0, 9.95]} size={[7.8, 4.1]} color="#d9b44a" />
      <LoungeTV />
      <Sofa x={-8} z={8.6} />
      <Armchair x={-10.8} z={9} />
      <Armchair x={-5.2} z={9} />
      <Box size={[1.3, 0.35, 0.7]} pos={[-8, 0.18, 10.5]} color="#8d6e63" />
      <Box size={[0.3, 0.06, 0.3]} pos={[-8.2, 0.38, 10.5]} color="#ef476f" />
      {/* ruang makan dan meja pingpong di sisi timur depan */}
      <Dining />
      <Pingpong x={9.3} z={9.5} />
    </Merged>
  )
}

export default memo(Office)
