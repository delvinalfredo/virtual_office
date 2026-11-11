import { Board, TaskForm } from './Board'
import { ChatUI } from './ChatUI'
import { AgentDM } from './AgentDM'
import { Sessions } from './Sessions'
import { useKantor } from './useKantor'
import { useControl } from './useControl'
import { useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react'

// three.js dan seluruh adegan dimuat belakangan, supaya panel dan chat tampil lebih dulu
const Scene = lazy(() => import('./Scene'))

// ?q=0..3 memaksa tingkat kualitas
const QS = new URLSearchParams(location.search)
const FORCED_Q = QS.has('q') ? Math.min(3, Math.max(0, Number(QS.get('q')) || 0)) : null
if (FORCED_Q !== null) { try { localStorage.setItem('kantor-q', String(FORCED_Q)) } catch { /* abaikan */ } }

// ?q=0 juga menghapus pilihan lama yang tersimpan, jadi cara mengembalikan kualitas penuh
const savedQ = () => { try { return Math.min(3, Number(localStorage.getItem('kantor-q')) || 0) } catch { return 0 } }
// layar sempit: panel tertutup dulu supaya kantornya kelihatan, kecuali pemain pernah memilih sendiri
const savedBoard = () => {
  try {
    const v = localStorage.getItem('kantor-board')
    return v === null ? innerWidth >= 900 : v !== 'off'
  } catch { return innerWidth >= 900 }
}

export default function App() {
  const [cameraMode, setCameraMode] = useState('follow')
  // kamera bebas berputar di sekitar titik ini (posisi pemain saat mode dinyalakan)
  const playerPosRef = useRef({ x: 0, z: 6 })
  const [orbitTarget, setOrbitTarget] = useState([0, 1, 6])
  const [quality, setQuality] = useState(() => FORCED_Q ?? savedQ())
  const { agents, agentsStatic, tasks, peers, chat, events, online, sessionsTick, tasksTick, addTask, sendPos, sendChat } = useKantor()
  const control = useControl(sessionsTick)
  const [dmAgent, setDmAgent] = useState(null)
  const [hint, setHint] = useState(null) // petunjuk tombol F di dok: tempat yang bisa dipakai di dekat pemain
  // panel kiri dan kanan bisa disembunyikan supaya kantornya kelihatan; pilihan diingat
  const [boardOn, setBoardOn] = useState(savedBoard)
  const toggleBoard = () => setBoardOn((v) => { try { localStorage.setItem('kantor-board', v ? 'off' : 'on') } catch { /* abaikan */ } return !v })
  // nama tersimpan di browser; kalau belum ada, acak sekali lalu diingat
  const [playerName, setPlayerName] = useState(() => {
    try {
      const saved = localStorage.getItem('kantor-name')
      if (saved) return saved
    } catch { /* localStorage diblokir: pakai nama acak saja */ }
    return `kamu-${Math.floor(Math.random() * 900 + 100)}`
  })
  const [nameDraft, setNameDraft] = useState(playerName)
  // chat terakhir yang kukirim: gelembung di atas kepalaku. Nama di server bisa diberi suffix, jadi tidak
  // dicari dari daftar chat; pemain lain dicari dari daftar chat lewat namanya.
  const [mySaid, setMySaid] = useState(null)
  const saidBy = useMemo(() => {
    const m = {}
    for (const c of chat) if (c.agent === null && c.seen) m[c.name] = c
    return m
  }, [chat])

  const commitName = () => {
    const next = nameDraft.trim().slice(0, 24)
    if (!next) return setNameDraft(playerName) // kosong: batalkan, jangan kirim nama kosong
    setNameDraft(next)
    setPlayerName(next)
    try { localStorage.setItem('kantor-name', next) } catch { /* abaikan */ }
  }

  const onPos = useCallback((p) => {
    playerPosRef.current = p
    sendPos(playerName, p.x, p.z, p.t, p.pose, p.h)
  }, [sendPos, playerName])

  const deleteTask = useCallback((id) => {
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  const say = (text) => {
    sendChat(text)
    setMySaid({ text, seen: Date.now() })
  }

  const active = tasks.filter((t) => t.status !== 'done').length

  return (
    <div className="stage">
      <Suspense fallback={<div role="status" className="status panel">Memuat kantor 3D.</div>}>
        <Scene
          quality={quality}
          forcedQuality={FORCED_Q !== null}
          onQuality={setQuality}
          cameraMode={cameraMode}
          orbitTarget={orbitTarget}
          onPos={onPos}
          onHint={setHint}
          mySaid={mySaid}
          agents={agents}
          agentsStatic={agentsStatic}
          onAgentClick={setDmAgent}
          peers={peers}
          saidBy={saidBy}
        />
      </Suspense>

      <button className="btn sm boardbtn" aria-pressed={boardOn} onClick={toggleBoard}>
        {boardOn ? 'Sembunyikan panel' : `Panel${active ? ` (${active})` : ''}`}
      </button>
      <Board
        tasks={tasks}
        agents={agents}
        agentsStatic={agentsStatic}
        events={events}
        onDelete={deleteTask}
        control={control}
        hidden={!boardOn}
        tick={tasksTick}
        form={<TaskForm onAdd={addTask} control={control} />}
      />
      <Sessions control={control} />
      <ChatUI chat={chat} onSend={say} />
      {dmAgent && (
        <AgentDM
          agentId={dmAgent}
          onClose={() => setDmAgent(null)}
          onSend={(t, agent) => sendChat(t, agent)}
        />
      )}
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
        <span>WASD jalan, Q/E putar, Enter chat{hint ? `, ${hint}` : ''}</span>
        <label>
          <input
            type="checkbox"
            checked={cameraMode === 'orbit'}
            onChange={(e) => {
              if (e.target.checked) setOrbitTarget([playerPosRef.current.x, 1, playerPosRef.current.z])
              setCameraMode(e.target.checked ? 'orbit' : 'follow')
            }}
          />
          Kamera bebas
        </label>
      </div>
    </div>
  )
}
