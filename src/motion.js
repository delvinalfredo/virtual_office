// Peredam eksponensial: hasilnya sama di 60 fps maupun 144 fps, tidak seperti lerp(dt * k).
export const damp = (cur, goal, rate, dt) => cur + (goal - cur) * (1 - Math.exp(-rate * dt))

// Sama, tapi lewat jalur sudut terpendek supaya karakter tidak berputar balik 350 derajat.
export const dampAngle = (cur, goal, rate, dt) => {
  const d = Math.atan2(Math.sin(goal - cur), Math.cos(goal - cur))
  return cur + d * (1 - Math.exp(-rate * dt))
}
