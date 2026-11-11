import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Office from './Office'
import SkyDeco from './SkyDeco'
import Perf from './Perf'
import AutoQuality from './AutoQuality'
import { Player } from './Avatar'
import AgentAvatars from './AgentAvatars'
import PeerAvatars from './PeerAvatars'
import { SKY_FOG, GROUND_BOUNCE } from './theme3d'

// tingkat kualitas: 0 penuh, 1 resolusi 1x, 2 tanpa bayangan, 3 resolusi 0,75x tanpa bayangan
const DPR = [[1, 1.5], 1, 1, 0.75]
// ?perf di alamat halaman menampilkan FPS dan jumlah draw call
const SHOW_PERF = new URLSearchParams(location.search).has('perf')

// Seluruh adegan 3D. Dipisah dari App supaya three.js dimuat belakangan (lazy) dan panel langsung tampil.
export default function Scene({ quality, forcedQuality, onQuality, cameraMode, orbitTarget, onPos, onHint, mySaid, agents, agentsStatic, onAgentClick, peers, saidBy }) {
  return (
    <Canvas
      shadows
      dpr={DPR[quality]}
      camera={{ position: [0, 10, 14], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <fog attach="fog" args={[SKY_FOG, 40, 95]} />
      <hemisphereLight args={['#ffffff', GROUND_BOUNCE, 0.75]} />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.5}
        castShadow={quality < 2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      {SHOW_PERF && <Perf quality={quality} />}
      {!forcedQuality && <AutoQuality quality={quality} onDrop={onQuality} />}
      <SkyDeco />
      <Office />
      <Player onPos={onPos} onHint={onHint} said={mySaid} free={cameraMode === 'orbit'} />
      <AgentAvatars agents={agents} agentsStatic={agentsStatic} onAgentClick={onAgentClick} />
      <PeerAvatars peers={peers} saidBy={saidBy} />
      {cameraMode === 'orbit' && (
        <OrbitControls makeDefault target={orbitTarget} minDistance={2} maxDistance={70} maxPolarAngle={Math.PI / 2.05} />
      )}
    </Canvas>
  )
}
