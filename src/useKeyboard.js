import { useEffect, useRef } from 'react'

export function useKeyboard() {
  // Set harus persist antar render — kalau dibuat di body komponen,
  // re-render (berlangsung ~20x/detik via WS) men-swallow tombol yang sedang ditahan.
  const keys = useRef(new Set()).current

  useEffect(() => {
    const MAP = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' }
    const norm = (e) => {
      const k = e.key.toLowerCase()
      return MAP[k] ?? k
    }
    const kd = (e) => {
      const k = norm(e)
      if ('wasdqe'.includes(k) && k) keys.add(k)
    }
    const ku = (e) => keys.delete(norm(e))
    const blur = () => keys.clear()
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
    }
  }, [keys])

  return keys
}
