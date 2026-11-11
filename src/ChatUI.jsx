import { useState, useEffect, useRef } from 'react'

// Chat bar bawah tengah: ketik + Enter utk kirim. Tampil history pendek di atasnya.
export function ChatUI({ chat, onSend }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  // Enter fokus biar langsung ketik; Escape keluar
  useEffect(() => {
    const kd = (e) => {
      // Enter di kolom isian atau tombol (submit form task, tombol board) bukan perintah buka chat
      const onControl = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, [role="button"]')
      if (e.key === 'Enter' && !open && !onControl) {
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

  // petunjuk "Enter untuk chat" ada di dok kiri bawah, jadi tidak ada pil petunjuk lagi di sini
  return (
    <div className="chat" aria-live="polite">
      {recent.map((c, i) => (
        <div key={c.at + i} className={`msg${c.agent !== null ? ' agent' : ''}${i === recent.length - 1 ? '' : ' old'}`}>
          <b>{c.name}{c.agent !== null ? ' (agent)' : ''}:</b> {c.text}
        </div>
      ))}
      {open && (
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ketik pesan. Enter kirim, Esc tutup"
            aria-label="Pesan chat"
            maxLength={120}
          />
        </form>
      )}
    </div>
  )
}
