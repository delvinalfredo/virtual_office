import { Billboard, Text } from '@react-three/drei'

// bubble chat umum di atas kepala
export function ChatBubble({ text }) {
  return (
    <Billboard position={[0, 2.0, 0]}>
      <Text
        fontSize={0.18}
        color="#fff"
        anchorX="center"
        maxWidth={2.6}
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {text}
      </Text>
    </Billboard>
  )
}
