import { useState, useEffect, useRef } from 'react'

// Chat bar bawah tengah: ketik + Enter utk kirim. Tampil history pendek di atasnya.
export function ChatUI({ chat, onSend }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  // Enter fokus biar langsung ketik; Escape keluar
  useEffect(() => {
    const kd = (e) => {
      if (e.key === 'Enter' && !open) {
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  }, [open])

  const submit = (e) => {
    e.preventDefault()
    if (text.trim()) onSend(text.trim())
    setText('')
    setOpen(false)
  }

  const recent = chat.slice(-4)

  return (
    <div style={{
      position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
      width: 460, fontFamily: 'sans-serif', zIndex: 15, pointerEvents: 'none',
    }}>
      {/* riwayat 4 pesan terakhir */}
      {recent.map((c, i) => (
        <div key={c.at + i} style={{
          background: c.agent !== null ? 'rgba(46,204,113,0.85)' : 'rgba(20,24,32,0.8)',
          color: '#fff', fontSize: 12, borderRadius: 8, padding: '4px 10px',
          marginBottom: 3, width: 'fit-content', maxWidth: '100%',
          opacity: i === recent.length - 1 ? 1 : 0.55,
        }}>
          <b>{c.agent !== null ? '🤖 ' : ''}{c.name}:</b> {c.text}
        </div>
      ))}
      {/* input */}
      {open && (
        <form onSubmit={submit} style={{ pointerEvents: 'auto', marginTop: 4 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ketik pesan... (Enter kirim, Esc tutup)"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13,
              border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(20,24,32,0.92)',
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </form>
      )}
    </div>
  )
}

// hint toggle kecil
export function ChatHint({ open }) {
  return open ? null : (
    <div style={{
      position: 'fixed', bottom: 34, left: '50%', transform: 'translateX(-50%)',
      color: 'rgba(255,255,255,0.75)', fontSize: 11, fontFamily: 'sans-serif', zIndex: 15,
      pointerEvents: 'none',
    }}>
      [Enter] chat
    </div>
  )
}
