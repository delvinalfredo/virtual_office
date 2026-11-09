// SFX kecil pakai WebAudio oscillator — tanpa file audio
let ctx = null

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, c.currentTime + when)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + when)
  o.stop(c.currentTime + when + dur)
}

export const sfx = {
  // langkah kaki: klik pendek rendah
  step() {
    tone(90 + Math.random() * 30, 0.06, 'triangle', 0.05)
  },
  // ketikan: klik tinggi pendek
  key() {
    tone(1200 + Math.random() * 400, 0.02, 'square', 0.02)
  },
  // task selesai: chime 2 nada
  done() {
    tone(660, 0.15, 'sine', 0.12)
    tone(880, 0.25, 'sine', 0.12, 0.12)
  },
  // task baru masuk
  pop() {
    tone(440, 0.08, 'sine', 0.08)
    tone(560, 0.1, 'sine', 0.08, 0.06)
  },
}
