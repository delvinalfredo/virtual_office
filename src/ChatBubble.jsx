import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'

// gelembung ucapan di atas kepala (DOM, jadi emoji dan font ikut tema).
// lift menaikkan gelembung supaya yang berdekatan tidak saling menutup.
export function ChatBubble({ text, lift = 0 }) {
  return (
    <Html position={[0, 2.75 + lift, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
      <div className="say">{text}</div>
    </Html>
  )
}

const SAID_MS = 5000

// gelembung chat pemain: muncul saat pesan baru tiba, hilang sendiri beberapa detik kemudian
export function Said({ msg }) {
  const [shown, setShown] = useState(msg)
  // pesan baru dideteksi saat render (bandingkan dengan nilai sebelumnya), bukan lewat efek
  const [prev, setPrev] = useState(msg)
  if (msg !== prev) { setPrev(msg); setShown(msg) }
  useEffect(() => {
    if (!shown) return undefined
    const t = setTimeout(() => setShown(null), SAID_MS)
    return () => clearTimeout(t)
  }, [shown])
  return shown ? <ChatBubble key={shown.seen} text={shown.text} /> : null
}
