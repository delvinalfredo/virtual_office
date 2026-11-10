import { useRef, useLayoutEffect } from 'react'
import { toonMat, OUTLINE_MAT } from './toon'

// Kotak toon dengan garis tepi. Tebal garis tetap (bukan skala), supaya benda tipis seperti
// keyboard dan layar tetap rapi, sedangkan meja besar tidak mendapat garis yang kelewat tebal.
export function Box({ size, pos, color, ink = 0.03, ...props }) {
  return (
    <mesh position={pos} castShadow receiveShadow material={toonMat(color)} {...props}>
      <boxGeometry args={size} />
      {ink > 0 && (
        <mesh material={OUTLINE_MAT}>
          <boxGeometry args={size.map((v) => v + ink * 2)} />
        </mesh>
      )}
    </mesh>
  )
}

// Garis tepi untuk bentuk selain kotak: salinan geometri induknya yang sedikit membesar.
// Taruh sebagai anak mesh, setelah geometri dan bahan.
export function Ink({ scale = 1.08 }) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current.geometry = ref.current.parent.geometry
  }, [])
  return <mesh ref={ref} material={OUTLINE_MAT} scale={scale} />
}
