const WALL = 12

function Box({ size, pos, color, ...props }) {
  return (
    <mesh position={pos} castShadow receiveShadow {...props}>
      <boxGeometry args={size} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

function Rug({ pos, size, color }) {
  return (
    <mesh position={[pos[0], 0.055, pos[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshToonMaterial color={color} />
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
        <meshToonMaterial color="#8a5a33" />
      </mesh>
      <mesh position={[0, 2.3, 0]} castShadow>
        <dodecahedronGeometry args={[1.1, 0]} />
        <meshToonMaterial color="#3faa4e" />
      </mesh>
      <mesh position={[0.6, 2.9, 0.3]} castShadow>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshToonMaterial color="#4fc361" />
      </mesh>
      <mesh position={[-0.5, 3.1, -0.2]} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshToonMaterial color="#35944a" />
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
        <meshToonMaterial color="#43b052" />
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
        <meshToonMaterial color="#37474f" />
      </mesh>
      <mesh position={[0, 3.3, 0.35]} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.32]} />
        <meshToonMaterial color="#37474f" />
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

// awan low poly melayang di langit
function Cloud({ x, y, z, s = 1 }) {
  return (
    <group position={[x, y, z]} scale={s}>
      <mesh>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.9, -0.15, 0]}>
        <dodecahedronGeometry args={[0.65, 0]} />
        <meshToonMaterial color="#f7fbff" />
      </mesh>
      <mesh position={[-0.8, -0.1, 0.2]}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshToonMaterial color="#f7fbff" />
      </mesh>
    </group>
  )
}

// papan lantai kayu: some strips bergaris dengan warna sedikit beda
function WoodFloor() {
  const strips = []
  const n = 24
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const shade = ((i * 7 + j * 13) % 5) * 0.5
      const colors = ['#d9a05b', '#d2954e', '#cf9450', '#d8a660', '#c98f45']
      strips.push(
        <mesh key={`${i}-${j}`} position={[-WALL + (j + 0.5) * (2 * WALL) / n, 0.03 + (i % 2) * 0.001, -WALL + (i + 0.5) * (2 * WALL) / n]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[(2 * WALL) / n - 0.04, (2 * WALL) / n - 0.02]} />
          <meshStandardMaterial color={colors[(i + j) % 5]} />
        </mesh>
      )
    }
  }
  return (
    <group>
      {/* dasar tanah di bawah strip, supaya celah tidak memperlihatkan rumput */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * WALL, 2 * WALL]} />
        <meshStandardMaterial color="#c98f45" />
      </mesh>
      {strips}
    </group>
  )
}

function Desk({ x, z, rot = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Box size={[2.4, 0.1, 1.2]} pos={[0, 0.75, 0]} color="#c8a06a" />
      <Box size={[0.15, 0.75, 0.15]} pos={[-1, 0.37, 0.45]} color="#9a7748" />
      <Box size={[0.15, 0.75, 0.15]} pos={[1, 0.37, 0.45]} color="#9a7748" />
      <Box size={[0.15, 0.75, 0.15]} pos={[-1, 0.37, -0.45]} color="#9a7748" />
      <Box size={[0.15, 0.75, 0.15]} pos={[1, 0.37, -0.45]} color="#9a7748" />
      {/* monitor layar biru muda menyala */}
      <Box size={[0.7, 0.45, 0.05]} pos={[0, 1.2, 0]} color="#aee3f7" />
      <Box size={[0.05, 0.28, 0.05]} pos={[0, 0.93, 0]} color="#5a5a5a" />
      <Box size={[0.36, 0.03, 0.2]} pos={[0, 0.8, 0]} color="#5a5a5a" />
      {/* keyboard */}
      <Box size={[0.5, 0.03, 0.18]} pos={[0, 0.83, 0.35]} color="#e8e8e8" />
      {/* mug warna acak per meja */}
      <mesh position={[0.8, 0.87, 0.3]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.14, 12]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
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
    <group position={[0, 0, -7]}>
      <Box size={[4, 0.15, 2]} pos={[0, 0.75, 0]} color="#f5e6c8" />
      <Box size={[0.2, 0.75, 0.2]} pos={[-1.6, 0.37, 0]} color="#c9a86a" />
      <Box size={[0.2, 0.75, 0.2]} pos={[1.6, 0.37, 0]} color="#c9a86a" />
      <Rug pos={[0, 0, 0]} size={[6.5, 4.5]} color="#c0392b" />
      {/* papan tulis + frame */}
      <Box size={[3, 1.5, 0.08]} pos={[0, 1.9, -1.2]} color="#fdfdfd" />
      <Box size={[3.2, 1.7, 0.04]} pos={[0, 1.9, -1.24]} color="#8d6e63" />
      {/* tissues / properti kecil di meja */}
      <Box size={[0.3, 0.2, 0.3]} pos={[0, 0.95, 0]} color="#ecf0f1" />
      <Chair x={-1.6} z={-1.3} color="#8e44ad" />
      <Chair x={1.6} z={-1.3} color="#8e44ad" />
      <Chair x={-1.6} z={1.3} rot={Math.PI} color="#8e44ad" />
      <Chair x={1.6} z={1.3} rot={Math.PI} color="#8e44ad" />
      {[-2.6, 2.6].map((x, i) => (
        <Chair key={`cside${i}`} x={x} z={0} rot={Math.PI / 2} color="#8e44ad" />
      ))}
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
      {/* net & bola */}
      <mesh position={[0.4, 0.9, 0.1]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshToonMaterial color="#fdfdfd" />
      </mesh>
    </group>
  )
}

function Plant({ x, z, scale = 1 }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 16]} />
        <meshToonMaterial color="#b5651d" />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <dodecahedronGeometry args={[0.42, 0]} />
        <meshToonMaterial color="#27ae60" />
      </mesh>
      <mesh position={[0.18, 1.15, 0]} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshToonMaterial color="#2ecc71" />
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

export default function Office() {
  return (
    <group>
      <WoodFloor />

      {/* rumput di luar */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshToonMaterial color="#7ec850" />
      </mesh>

      {/* jalan masuk setapak */}
      <mesh position={[0, -0.04, WALL + 2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 5]} />
        <meshToonMaterial color="#b8b8b0" />
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
      <Vending x={11.2} z={-4} rot={-Math.PI / 2} />
      <Vending x={11.2} z={-5.3} rot={-Math.PI / 2} />
      <Arcade x={11.2} z={-7} rot={-Math.PI / 2} />
      <Arcade x={11.2} z={-8} rot={-Math.PI / 2} />

      {/* awan di langit */}
      <Cloud x={-10} y={9} z={-8} s={1.3} />
      <Cloud x={8} y={10} z={-4} s={1} />
      <Cloud x={2} y={11} z={8} s={1.5} />
      <Cloud x={-6} y={9.5} z={12} s={0.9} />

      {/* dinding modern: pilar + panel kaca transparan, tinggi 2.6 */}
      {[
        [-WALL + 2, -WALL], [-WALL + 9, -WALL], [WALL - 2, -WALL], [WALL - 9, -WALL],
        [-WALL, -WALL + 2], [-WALL, -WALL + 9], [-WALL, WALL - 2], [-WALL, WALL - 9],
        [WALL, -WALL + 2], [WALL, -WALL + 9], [WALL, WALL - 2], [WALL, WALL - 9],
      ].map(([x, z], i) => (
        <Box key={`pil${i}`} size={[0.35, 2.6, 0.35]} pos={[x, 1.3, z]} color="#fcfcf7" />
      ))}
      {/* panel kaca antar pilar dinding belakang & kiri & kanan */}
      {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((off, i) => (
        <mesh key={`gb${i}`} position={[off, 1.3, -WALL]}>
          <boxGeometry args={[2.2, 2.6, 0.08]} />
          <meshStandardMaterial color="#bfe3f7" transparent opacity={0.28} />
        </mesh>
      ))}
      {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((off, i) => (
        <mesh key={`gl${i}`} position={[-WALL, 1.3, off]}>
          <boxGeometry args={[0.08, 2.6, 2.2]} />
          <meshStandardMaterial color="#bfe3f7" transparent opacity={0.28} />
        </mesh>
      ))}
      {[-7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2].map((off, i) => (
        <mesh key={`gr${i}`} position={[WALL, 1.3, off]}>
          <boxGeometry args={[0.08, 2.6, 2.2]} />
          <meshStandardMaterial color="#bfe3f7" transparent opacity={0.28} />
        </mesh>
      ))}
      {/* dinding depan: pilar doang + pegangan rendah */}
      {[-10.5, -5, 0, 5, 10.5].map((x, i) => (
        <Box key={`pd${i}`} size={[0.35, 2.6, 0.35]} pos={[x, 1.3, WALL]} color="#fcfcf7" />
      ))}
      {[-8, -2.5, 3, 8.5].map((x, i) => (
        <mesh key={`fh${i}`} position={[x, 0.75, WALL]}>
          <boxGeometry args={[4.6, 0.12, 0.1]} />
          <meshToonMaterial color="#fcfcf7" />
        </mesh>
      ))}

      {/* karpet zona: warna terang hook modern */}
      <Rug pos={[0, 0, 1]} size={[8, 8]} color="#8d6fe3" />
      <Rug pos={[-8.5, 0, -1]} size={[6.5, 5.5]} color="#68c7c4" />
      <Rug pos={[8.5, 0, -2]} size={[5.5, 7]} color="#f0a35e" />

      {/* 4 desk 2x2 grid di atas karpet ungu */}
      <Desk x={-4} z={4} />
      <Desk x={-4} z={1} />
      <Desk x={4} z={4} rot={Math.PI} />
      <Desk x={4} z={1} rot={Math.PI} />
      <Chair x={-4} z={5.4} color="#3498db" />
      <Chair x={-4} z={-0.4} rot={Math.PI} color="#3498db" />
      <Chair x={4} z={5.4} rot={Math.PI} color="#e74c3c" />
      <Chair x={4} z={-0.4} color="#e74c3c" />

      <Bookshelf x={-11} z={-9.5} rot={0} />
      <Bookshelf x={11} z={-9.5} rot={0} />

      {/* tanaman di pojok dan sela ruangan */}
      <Plant x={-WALL + 1} z={-WALL + 1} />
      <Plant x={-WALL + 1} z={WALL - 1} scale={0.8} />
      <Plant x={WALL - 1} z={-WALL + 1} />
      <Plant x={WALL - 1} z={WALL - 1} scale={0.8} />
      <Plant x={0} z={-4} scale={0.9} />
      <Plant x={6} z={-2} scale={0.7} />

      <MeetingTable />

      {/* LOUNGE ZONE (selatan-barat): karpet kuning, sofa, meja pingpong */}
      <Rug pos={[-8, 0, 8]} size={[6.5, 7]} color="#f1c40f" />
      <Sofa x={-8} z={10.5} />
      <Sofa x={-10.6} z={7} rot={Math.PI / 2} />
      <Pingpong x={-6.5} z={6} />

      {/* PORTAL: pintu bercahaya di tengah dinding depan menuju rooftop garden */}
      <group position={[0, 0, WALL - 0.5]}>
        <Box size={[1.6, 2.4, 0.15]} pos={[0, 1.2, 0]} color="#8e44ad" />
        <mesh position={[0, 1.2, 0.09]}>
          <boxGeometry args={[1.2, 2, 0.02]} />
          <meshToonMaterial color="#bf8bff" emissive="#8e44ad" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  )
}
