import { useEffect, useState, useRef, useCallback } from 'react'
import { sfx } from './sfx'

// koneksi ke server kantor: snapshot awal + update agents/tasks/peers
export function useKantor() {
  const [agents, setAgents] = useState([]) // runtime posisi: {id,x,z,heading,state,bubble}
  const [tasks, setTasks] = useState([])
  const [agentsStatic, setAgentsStatic] = useState([]) // {id,role,desk_x,desk_z,skill}
  const [peers, setPeers] = useState([]) // pemain lain (server tidak mengirim diri sendiri)
  const [chat, setChat] = useState([]) // {name,text,agent,at}
  const [online, setOnline] = useState(true)
  const wsRef = useRef(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    let stopped = false
    let attempt = 0
    let retryTimer

    const connect = () => {
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        attempt = 0
        setOnline(true)
      }
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'snapshot') {
          setAgents(m.agents)
          setAgentsStatic(m.agentsStatic)
          setTasks(m.tasks)
          setPeers(m.peers ?? [])
          setChat(m.chat ?? [])
        } else if (m.type === 'agents') {
          setAgents(m.agents)
        } else if (m.type === 'peers') {
          setPeers(m.peers)
        } else if (m.type === 'chat') {
          setChat((c) => [...c.slice(-50), m])
          sfx.key()
        } else if (m.type === 'task-update') {
          fetch('/api/tasks').then((r) => r.json()).then((next) => {
            const prev = tasksRef.current
            // chime ketika ada task baru berpindah ke done
            const wasDone = new Set(prev.filter(t => t.status === 'done').map(t => t.id))
            if (next.some(t => t.status === 'done' && !wasDone.has(t.id))) sfx.done()
            // pop ketika task baru masuk
            if (next.length > prev.length) sfx.pop()
            setTasks(next)
          }).catch(() => {})
        }
      }
      // putus (server restart, jaringan): coba lagi dengan jeda 1s, 2s, 4s, maksimal 10s
      ws.onclose = () => {
        // dicabut oleh cleanup (StrictMode memasang efek dua kali): jangan ganggu koneksi pengganti
        if (stopped) return
        setOnline(false)
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000))
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [])

  // callback stabil: identitas tak boleh berubah tiap render (WS re-render 8x/s),
  // kalau tidak interval posisi pemain di Player (deps onPos) terus di-teardown → posisi tak pernah ke-broadcast.
  // hasil: { ok: true } atau { ok: false, error } supaya form bisa menampilkan penolakan server
  const addTask = useCallback(async (title, est) => {
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, est }),
      })
      if (r.ok) return { ok: true }
      const body = await r.json().catch(() => ({}))
      return { ok: false, error: body.error ?? 'task gagal ditambahkan' }
    } catch {
      return { ok: false, error: 'server tidak terjangkau' }
    }
  }, [])

  const sendPos = useCallback((name, x, z, level = 0) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'player-pos', name, x, z, level }))
    }
  }, [])

  const sendChat = useCallback((text, agent = null) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(agent ? { type: 'dm-agent', agent, text } : { type: 'chat', text }))
      sfx.pop()
    }
  }, [])

  return { agents, agentsStatic, tasks, peers, chat, online, addTask, sendPos, sendChat }
}
