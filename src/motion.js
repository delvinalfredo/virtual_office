// Peredam eksponensial: hasilnya sama di 60 fps maupun 144 fps, tidak seperti lerp(dt * k).
export const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt))

// Sama, tapi lewat jalur sudut terpendek supaya karakter tidak berputar balik 350 derajat.
export const dampAngle = (cur, goal, rate, dt) => {
  const d = Math.atan2(Math.sin(goal - cur), Math.cos(goal - cur))
  return cur + d * (1 - Math.exp(-rate * dt))
}

// Interpolasi sudut lewat jalur terpendek, dengan k dari 0 sampai 1.
export const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k
