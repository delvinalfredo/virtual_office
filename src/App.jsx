import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Office from './Office'
import SkyDeco from './SkyDeco'
import Perf from './Perf'
import AutoQuality from './AutoQuality'
import { Player } from './Avatar'
import AgentAvatars from './AgentAvatars'
import PeerAvatars from './PeerAvatars'
import { Board, TaskForm } from './Board'
import { Minimap } from './Minimap'
import { ChatUI } from './ChatUI'
import { AgentDM } from './AgentDM'
import { Sessions } from './Sessions'
import { useKantor } from './useKantor'
import { useControl } from './useControl'
import { useState, useRef, useCallback } from 'react'
import { SKY_FOG, GROUND_BOUNCE } from './theme3d'

// ?perf di alamat halaman menampilkan FPS dan jumlah draw call; ?q=0..3 memaksa tingkat kualitas
const QS = new URLSearchParams(location.search)
const SHOW_PERF = QS.has('perf')
const FORCED_Q = QS.has('q') ? Math.min(3, Math.max(0, Number(QS.get('q')) || 0)) : null
// ?q=0 juga menghapus pilihan lama yang tersimpan, jadi cara mengembalikan kualitas penuh
if (FORCED_Q !== null) { try { localStorage.setItem('kantor-q', String(FORCED_Q)) } catch { /* abaikan */ } }
// tingkat kualitas: 0 penuh, 1 resolusi 1x, 2 tanpa bayangan, 3 resolusi 0,75x tanpa bayangan
const DPR = [[1, 1.5], 1, 1, 0.75]
const savedQ = () => { try { return Math.min(3, Number(localStorage.getItem('kantor-q')) || 0) } catch { return 0 } }

export default function App() {
  const [cameraMode, setCameraMode] = useState('follow')
  const [quality, setQuality] = useState(() => FORCED_Q ?? savedQ())
  const { agents, agentsStatic, tasks, peers, chat, online, sessionsTick, addTask, sendPos, sendChat } = useKantor()
  const control = useControl(sessionsTick)
  const [dmAgent, setDmAgent] = useState(null)
  // nama tersimpan di browser; kalau belum ada, acak sekali lalu diingat
  const [playerName, setPlayerName] = useState(() => {
    try {
      const saved = localStorage.getItem('kantor-name')
      if (saved) return saved
    } catch { /* localStorage diblokir: pakai nama acak saja */ }
    return `kamu-${Math.floor(Math.random() * 900 + 100)}`
  })
  const [nameDraft, setNameDraft] = useState(playerName)
  const teleportRef = useRef(null)
  const playerPosRef = useRef({ x: 0, z: 6 })

  const commitName = () => {
    const next = nameDraft.trim().slice(0, 24)
    if (!next) return setNameDraft(playerName) // kosong: batalkan, jangan kirim nama kosong
    setNameDraft(next)
    setPlayerName(next)
    try { localStorage.setItem('kantor-name', next) } catch { /* abaikan */ }
  }

  const onPos = useCallback((p) => {
    playerPosRef.current = p
    sendPos(playerName, p.x, p.z, p.t)
  }, [sendPos, playerName])

  const deleteTask = useCallback((id) => {
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  return (
    <div className="stage">
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
        {FORCED_Q === null && <AutoQuality quality={quality} onDrop={setQuality} />}
        <SkyDeco />
        <Office />
        <Player onPos={onPos} teleportRef={teleportRef} />
        <AgentAvatars agents={agents} agentsStatic={agentsStatic} onAgentClick={setDmAgent} />
        <PeerAvatars peers={peers} />
        {cameraMode === 'orbit' && <OrbitControls />}
      </Canvas>

      <Board tasks={tasks} onDelete={deleteTask} control={control} />
      <Sessions control={control} />
      <ChatUI chat={chat} onSend={(t) => sendChat(t)} />
      {dmAgent && (
        <AgentDM
          agentId={dmAgent}
          onClose={() => setDmAgent(null)}
          onSend={(t, agent) => sendChat(t, agent)}
        />
      )}
      <Minimap
        playerRef={playerPosRef}
        agents={agents}
        onTeleport={(p) => teleportRef.current?.(p)}
      />
      <TaskForm onAdd={addTask} control={control} />

      {!online && (
        <div role="status" className="status panel">
          Koneksi ke server putus. Mencoba tersambung lagi.
        </div>
      )}

      <div className="dock panel">
        <label>
          Nama
          <input
            className="field"
            value={nameDraft}
            maxLength={24}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
        </label>
        <span>WASD atau panah untuk jalan, Q/E untuk memutar</span>
        <label>
          <input
            type="checkbox"
            checked={cameraMode === 'orbit'}
            onChange={(e) => setCameraMode(e.target.checked ? 'orbit' : 'follow')}
          />
          Kamera bebas
        </label>
      </div>
    </div>
  )
}
