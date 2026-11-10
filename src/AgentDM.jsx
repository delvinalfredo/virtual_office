import { useState, useEffect } from 'react'
import { lookFor } from './looks'

// Modal DM ke agent: muncul saat klik avatar agent di 3D
const QUICK = ['Ada update?', 'Prioritas task ini', 'Terima kasih!', 'BTW makan siang?']

export function AgentDM({ agentId, onClose, onSend }) {
  const look = lookFor(agentId)
  const [text, setText] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = (t) => {
    if (!t.trim()) return
    onSend(t.trim(), agentId)
    onClose()
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog panel" role="dialog" aria-modal="true" aria-label={`Pesan ke ${agentId}`} onClick={(e) => e.stopPropagation()}>
        <div className="who-head">
          <div className="badge" style={{ '--tag': look.tag }}>{agentId[0].toUpperCase()}</div>
          <div>
            <b>{agentId}</b>
            <small>{look.label}</small>
          </div>
        </div>
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q} className="btn sm" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
        <form className="dm" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <input
            autoFocus
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Ketik ke ${agentId}`}
            aria-label={`Pesan ke ${agentId}`}
            maxLength={120}
          />
          <button type="submit" className="btn go">Kirim</button>
        </form>
      </div>
    </div>
  )
}
