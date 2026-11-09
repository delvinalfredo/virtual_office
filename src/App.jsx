import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Office from './Office'
import Rooftop from './Rooftop'
import { Player } from './Avatar'
import AgentAvatars from './AgentAvatars'
import PeerAvatars from './PeerAvatars'
import { Board, TaskForm } from './Board'
import { Minimap } from './Minimap'
import { ChatUI, ChatHint } from './ChatUI'
import { AgentDM } from './AgentDM'
import { useKantor } from './useKantor'
import { useState, useRef, useCallback } from 'react'
import { useKeyboard } from './useKeyboard'

export default function App() {
  const [cameraMode, setCameraMode] = useState('follow')
  const { agents, agentsStatic, tasks, peers, chat, addTask, sendPos, sendChat } = useKantor()
  const [dmAgent, setDmAgent] = useState(null)
  const playerName = useRef(`kamu-${Math.floor(Math.random() * 900 + 100)}`).current
  const teleportRef = useRef(null)
  const playerPosRef = useRef({ x: 0, z: 6 })

  const onPos = useCallback((p) => {
    playerPosRef.current = p
    sendPos(playerName, p.x, p.z)
  }, [sendPos, playerName])

  const deleteTask = useCallback((id) => {
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#8ec9f5' }}>
      <Canvas shadows camera={{ position: [0, 10, 14], fov: 50 }}>
        <color attach="background" args={['#8ec9f5']} />
        <fog attach="fog" args={['#8ec9f5', 40, 90]} />
        <hemisphereLight args={['#ffffff', '#7ec850', 0.7]} />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <Office />
        <Rooftop />
        <Player onPos={onPos} teleportRef={teleportRef} />
        <AgentAvatars agents={agents} agentsStatic={agentsStatic} onAgentClick={setDmAgent} />
        <PeerAvatars peers={peers.filter((p) => p.name !== playerName)} />
        {cameraMode === 'orbit' && <OrbitControls />}
      </Canvas>

      <Board tasks={tasks} onDelete={deleteTask} />
      <ChatUI chat={chat} onSend={(t) => sendChat(t)} />
      <ChatHint />
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

      <div style={{ position: 'fixed', bottom: 16, left: 16, color: '#fff', fontFamily: 'sans-serif', fontSize: 14 }}>
        WASD / panah = jalan &nbsp;|&nbsp;
        <label style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            style={{ verticalAlign: 'middle' }}
            checked={cameraMode === 'orbit'}
            onChange={(e) => setCameraMode(e.target.checked ? 'orbit' : 'follow')}
          />
          {' '}camera bebas (orbit)
        </label>
      </div>
    </div>
  )
}
