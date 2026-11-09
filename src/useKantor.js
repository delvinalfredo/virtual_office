import { useEffect, useState, useRef } from 'react'
import { sfx } from './sfx'

// koneksi ke server kantor: snapshot awal + update agents/tasks/peers
export function useKantor() {
  const [agents, setAgents] = useState([]) // runtime posisi: {id,x,z,heading,state,bubble}
  const [tasks, setTasks] = useState([])
  const [agentsStatic, setAgentsStatic] = useState([]) // {id,role,desk_x,desk_z,skill}
  const [peers, setPeers] = useState([])
  const [chat, setChat] = useState([]) // {name,text,agent,at}
  const wsRef = useRef(null)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.type === 'snapshot') {
        setAgents(m.agents)
        setAgentsStatic(m.agentsStatic)
        setTasks(m.tasks)
        setPeers(m.peers ?? [])
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
    return () => ws.close()
  }, [])

  const addTask = (title, est) =>
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, est }),
    })

  const sendPos = (name, x, z) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'player-pos', name, x, z }))
    }
  }

  const sendChat = (text, agent = null) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(agent ? { type: 'dm-agent', agent, text } : { type: 'chat', text }))
      sfx.pop()
    }
  }

  return { agents, agentsStatic, tasks, peers, chat, addTask, sendPos, sendChat }
}
