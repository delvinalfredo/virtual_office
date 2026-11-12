import { useEffect, useState, useRef, useCallback } from 'react'
import { sfx } from './sfx'
import { noteServerTime, push, resetInterp } from './interp'

// Posisi tidak lagi disimpan di state React. Tiap paket masuk ke penyimpan interpolasi (src/interp.js) dan
// dibaca per frame oleh karakternya. State React hanya berubah bila hal yang tampak berbeda (status, bubble,
// siapa yang ada), jadi aplikasi tidak dirender ulang 20 kali per detik.
const agentSig = (list) => list.map((a) => `${a.id}|${a.state}|${a.pose ?? ''}|${a.bubble ?? ''}`).join('\n')
const peerSig = (list) => list.map((p) => `${p.name}|${p.pose ?? ''}|${p.h ?? ''}`).join('\n')
const EVENT_MAX = 40 // sama dengan ring buffer eventLog di server
// Server lama belum mengirim cap waktu: pakai waktu tiba paket sebagai gantinya, supaya karakter tidak membeku.
function ingestAgents(list, ts) {
  const now = performance.now()
  const stamp = Number.isFinite(ts) ? ts : now
  noteServerTime('agent', stamp, now)
  for (const a of list) push('agent', a.id, stamp, a.x, a.z, a.heading)
}
function ingestPeers(list) {
  const now = performance.now()
  for (const p of list) {
    // jam pengirim (ct) dipakai bila ada: posisi dan waktunya diambil pada saat yang sama di browser pengirim,
    // jadi jitter jaringan dan server tidak ikut membentuk gerak. Tanpa ct, pakai cap waktu terima server.
    const own = Number.isFinite(p.ct)
    const stamp = own ? p.ct : Number.isFinite(p.ts) ? p.ts : now
    if (push('peer', p.name, stamp, p.x, p.z)) noteServerTime('peer', stamp, now, own ? p.name : '*')
  }
}

// koneksi ke server kantor: snapshot awal + update agents/tasks/peers
export function useKantor() {
  const [agents, setAgents] = useState([]) // runtime posisi: {id,x,z,heading,state,bubble}
  const [tasks, setTasks] = useState([])
  const [agentsStatic, setAgentsStatic] = useState([]) // {id,role,desk_x,desk_z,skill}
  const [peers, setPeers] = useState([]) // pemain lain (server tidak mengirim diri sendiri)
  const [chat, setChat] = useState([]) // {name,text,agent,at}
  const [events, setEvents] = useState([]) // kejadian task dari server: {who,text,at}, terbaru di akhir
  const [online, setOnline] = useState(true)
  const [sessionsTick, setSessionsTick] = useState(0) // naik tiap server memberi sinyal sesi Claude berubah
  // naik tiap sinyal task-update, termasuk perubahan pekerjaan besar yang tidak mengubah daftar task
  const [tasksTick, setTasksTick] = useState(0)
  const wsRef = useRef(null)
  const agentSigRef = useRef('')
  const peerSigRef = useRef('')
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    let stopped = false
    let attempt = 0
    let retryTimer

    const connect = () => {
      // dev: langsung ke backend (port 3000), tanpa proxy Vite; proxy ws Vite menambah satu lompatan dan
      // melaporkan "write ECONNABORTED" tiap tab ditutup. Produksi: Express yang menyajikan halaman sama dengan ws.
      const host = import.meta.env.DEV ? `${location.hostname}:3000` : location.host
      const ws = new WebSocket(`${proto}://${host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        attempt = 0
        setOnline(true)
      }
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'snapshot') {
          resetInterp() // server baru atau sambungan baru: jam dan riwayat posisi lama tidak berlaku
          ingestAgents(m.agents, m.ts)
          ingestPeers(m.peers ?? [])
          agentSigRef.current = agentSig(m.agents)
          peerSigRef.current = peerSig(m.peers ?? [])
          setAgents(m.agents)
          setAgentsStatic(m.agentsStatic)
          setTasks(m.tasks)
          setPeers(m.peers ?? [])
          setChat(m.chat ?? [])
          setEvents(m.events ?? [])
        } else if (m.type === 'event') {
          setEvents((e) => [...e.slice(1 - EVENT_MAX), m])
        } else if (m.type === 'agents') {
          ingestAgents(m.agents, m.ts)
          const sig = agentSig(m.agents)
          if (sig !== agentSigRef.current) { agentSigRef.current = sig; setAgents(m.agents) }
        } else if (m.type === 'peers') {
          ingestPeers(m.peers)
          const sig = peerSig(m.peers)
          if (sig !== peerSigRef.current) { peerSigRef.current = sig; setPeers(m.peers) }
        } else if (m.type === 'sessions') {
          setSessionsTick((t) => t + 1)
        } else if (m.type === 'chat') {
          // seen: jam browser ini saat pesan tiba, dipakai gelembung di atas kepala (riwayat dari snapshot tidak punya)
          setChat((c) => [...c.slice(-50), { ...m, seen: Date.now() }])
          sfx.key()
        } else if (m.type === 'task-update') {
          setTasksTick((t) => t + 1)
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

  // t: jam browser ini saat posisi diambil (performance.now), dikirim apa adanya sebagai ct
  const sendPos = useCallback((name, x, z, t = performance.now(), pose, h) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'player-pos', name, x, z, ct: +t.toFixed(1), pose, h }))
    }
  }, [])

  const sendChat = useCallback((text, agent = null) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(agent ? { type: 'dm-agent', agent, text } : { type: 'chat', text }))
      sfx.pop()
    }
  }, [])

  return { agents, agentsStatic, tasks, peers, chat, events, online, sessionsTick, tasksTick, addTask, sendPos, sendChat }
}
