// Rooftop garden ala The Sims: gumpalan taman kecil MELAYANG di atas kantor,
// bukan atap yang menutupi. Interior selalu terlihat dari luar.
import { Ink } from './props'
import { toonGradient } from './toon'

// pulau taman kecil: pot rumput oval berisi tanaman
function GardenIsland({ x, z, w = 3, d = 3 }) {
  return (
    <group position={[x, 3.05, z]}>
      {/* dasar tanah melayang */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[w / 2, w / 2 - 0.25, 0.35, 12]} />
        <meshToonMaterial color="#8a5a33" gradientMap={toonGradient()} />
        <Ink />
      </mesh>
      {/* rumput di atasnya */}
      <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[w / 2, 12]} />
        <meshToonMaterial color="#6abf4b" gradientMap={toonGradient()} />
      </mesh>
      {/* pohon kecil */}
      <group position={[0, 0.15, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
          <meshToonMaterial color="#9c6b3f" gradientMap={toonGradient()} />
          <Ink />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <dodecahedronGeometry args={[0.62, 0]} />
          <meshToonMaterial color="#3faa4e" gradientMap={toonGradient()} />
          <Ink />
        </mesh>
      </group>
      {/* bunga 2 warna */}
      {[-0.5, 0.55].map((dx, i) => (
        <group key={i} position={[dx, 0.2, i ? 0.4 : -0.4]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.1, 0.25, 8]} />
            <meshToonMaterial color="#b5651d" gradientMap={toonGradient()} />
            <Ink />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <dodecahedronGeometry args={[0.11, 0]} />
            <meshToonMaterial color={i ? '#e74c3c' : '#f1c40f'} gradientMap={toonGradient()} />
            <Ink />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Rooftop() {
  return (
    <group>
      {/* 5 pulau taman melayang di sisi utara/timur/barat — sisi selatan dikosongkan
          karena kamera selalu berdiri di selatan dan melihat ke utara */}
      <GardenIsland x={-10.5} z={-10.5} w={3.4} />
      <GardenIsland x={10.5} z={-10.5} w={3.4} />
      <GardenIsland x={-10.5} z={2} w={3.2} />
      <GardenIsland x={10.5} z={2} w={3.2} />
      <GardenIsland x={0} z={-11.5} w={2.8} />
    </group>
  )
}
