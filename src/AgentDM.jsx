import { useState } from 'react'
import { ROLES } from './Avatar'

// Modal DM ke agent: muncul saat klik avatar agent di 3D
export function AgentDM({ agentId, onClose, onSend }) {
  const role = ROLES[agentId] ?? ROLES.programmer
  const [text, setText] = useState('')
  const quick = ['Ada update?', 'Prioritas task ini', 'Terima kasih!', 'BTW makan siang?']

  const send = (t) => {
    if (!t.trim()) return
    onSend(t.trim(), agentId)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320, background: '#141820', borderRadius: 14, padding: 16, color: '#fff',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: role.body,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {agentId[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{agentId}</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{role.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {quick.map((q) => (
            <button key={q} onClick={() => send(q)} style={{
              padding: '6px 10px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, cursor: 'pointer',
            }}>
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text) }} style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`ketik ke ${agentId}...`}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid #444', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none',
            }}
          />
          <button type="submit" style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2ecc71',
            color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>
            ➤
          </button>
        </form>
      </div>
    </div>
  )
}
