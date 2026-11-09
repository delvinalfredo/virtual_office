export function useKeyboard() {
  const keys = new Set()
  // arrow keys aliased to wasd
  const MAP = {
    arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd',
  }

  const norm = (e) => {
    const k = e.key.toLowerCase()
    return MAP[k] ?? k
  }

  window.addEventListener('keydown', (e) => {
    const k = norm(e)
    if ('wasdqe'.includes(k)) keys.add(k)
  })
  window.addEventListener('keyup', (e) => {
    keys.delete(norm(e))
  })
  window.addEventListener('blur', () => keys.clear())

  return keys
}
