import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Office from './Office'
import Rooftop from './Rooftop'
import SkyDeco from './SkyDeco'
import { Player } from './Avatar'
import AgentAvatars from './AgentAvatars'
import PeerAvatars from './PeerAvatars'
import { Board, TaskForm } from './Board'
import { Minimap } from './Minimap'
import { ChatUI } from './ChatUI'
import { AgentDM } from './AgentDM'
import { useKantor } from './useKantor'
import { useState, useRef, useCallback } from 'react'
import { SKY_FOG, GROUND_BOUNCE } from './theme3d'

export default function App() {
  const [cameraMode, setCameraMode] = useState('follow')
  const { agents, agentsStatic, tasks, peers, chat, online, addTask, sendPos, sendChat } = useKantor()
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
    sendPos(playerName, p.x, p.z, p.level)
  }, [sendPos, playerName])

  const deleteTask = useCallback((id) => {
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  return (
    <div className="stage">
      <Canvas
        shadows
        camera={{ position: [0, 10, 14], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <fog attach="fog" args={[SKY_FOG, 40, 95]} />
        <hemisphereLight args={['#ffffff', GROUND_BOUNCE, 0.75]} />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <SkyDeco />
        <Office />
        <Rooftop />
        <Player onPos={onPos} teleportRef={teleportRef} />
        <AgentAvatars agents={agents} agentsStatic={agentsStatic} onAgentClick={setDmAgent} />
        <PeerAvatars peers={peers} />
        {cameraMode === 'orbit' && <OrbitControls />}
      </Canvas>

      <Board tasks={tasks} onDelete={deleteTask} />
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
      <TaskForm onAdd={addTask} />

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
