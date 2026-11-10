import { Html } from '@react-three/drei'

// gelembung ucapan di atas kepala (DOM, jadi emoji dan font ikut tema).
// lift menaikkan gelembung; tamu agen yang duduk berdekatan diberi tinggi berbeda supaya tidak saling menutup.
export function ChatBubble({ text, lift = 0 }) {
  return (
    <Html position={[0, 2.75 + lift, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
      <div className="say">{text}</div>
    </Html>
  )
}
