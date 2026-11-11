// Denah kantor yang dipakai client (render + collision player) dan server
// (path agent). Sumber tunggal supaya collision konsisten.
export const WALL = 12

// Denah area kerja: dua kelompok (CLUSTER_X) x dua garis sekat (SPINES); tiap garis sekat dikelilingi dua baris
// meja yang saling membelakangi, tiga meja per baris. Office.jsx menggambarnya dari konstanta yang sama.
export const CLUSTER_X = [-4.8, 4.8]
export const SPINES = [0, 5]
// Jarak kursi dari garis sekat. Meja sampai 0,95 dari sekat; kotak tabrakan 0,9 (di bawah) membuat agent yang
// radiusnya 0,5 berhenti 1,4 dari sekat, jadi duduk di 1,35 tanpa loncatan dan kaki masuk ke bawah meja.
export const CHAIR_DZ = 1.35

// Kursi kerja: tiap agent satu kursi. Datang tegak lurus dari ruang bebas di sisi kursinya (via), bukan menyusuri
// baris kursi, supaya tidak lewat kursi lain: sisi utara pasang 1 dari z -3, koridor antar pasang dari z 2,5, sisi
// selatan pasang 2 dari z 7,7. h = arah hadap: 0 menghadap +z (kursi sisi utara), PI menghadap -z.
const seat = (cx, k, si, north) => {
  const x = +(cx + k * 1.8).toFixed(2)
  const z = +(SPINES[si] + (north ? -CHAIR_DZ : CHAIR_DZ)).toFixed(2)
  const free = si === 0 ? (north ? -3 : 2.5) : north ? 2.5 : 7.7
  return { x, z, h: north ? 0 : Math.PI, via: { x, z: free } }
}
export const DESK_SEATS = {
  prog1: seat(-4.8, 1, 0, true),
  prog2: seat(4.8, -1, 0, true),
  designer: seat(-4.8, 1, 0, false),
  qa: seat(4.8, -1, 0, false),
  lead: seat(-4.8, 1, 1, true),
  prog3: seat(4.8, -1, 1, true),
  prog4: seat(-4.8, 0, 0, true),
  designer2: seat(4.8, 0, 0, false),
  qa2: seat(-4.8, 0, 1, true),
  prog5: seat(-4.8, 1, 1, false),
  designer3: seat(4.8, -1, 1, false),
}
const isSeat = (x, z) => Object.values(DESK_SEATS).some((d) => Math.abs(d.x - x) < 0.01 && Math.abs(d.z - z) < 0.01)

// pasang baris meja: satu kotak per pasang (sekat dan dua baris meja)
export const CLUSTERS = CLUSTER_X.flatMap((cx) => SPINES.map((s) => [cx, s, 2.75, 0.9]))
// kursi kerja yang kosong ikut jadi penghalang (agent dan pemain tidak menembusnya); kursi yang dipakai agent tidak
export const DESK_CHAIRS = CLUSTER_X.flatMap((cx) => SPINES.flatMap((s) => [-1.8, 0, 1.8].flatMap((dx) =>
  [s - CHAIR_DZ, s + CHAIR_DZ].map((z) => [cx + dx, z, 0.28, 0.28]),
))).filter(([x, z]) => !isSeat(x, z))

// obstacle: [cx, cz, halfW, halfZ] — kotak AABB di lantai
export const OBSTACLES = [
  ...CLUSTERS,
  ...DESK_CHAIRS,
  // ruang meeting (x -5 sampai 5, z -12 sampai -5): dinding barat, timur, dinding depan dengan pintu 2,4 m di tengah
  // (x -1,2 sampai 1,2), dua daun pintu yang terbuka ke dalam, lalu meja meeting 4 x 2
  [-5, -8.5, 0.1, 3.5],
  [5, -8.5, 0.1, 3.5],
  [-3.1, -5, 1.9, 0.1],
  [3.1, -5, 1.9, 0.1],
  [-1.14, -5.7, 0.06, 0.6],
  [1.14, -5.7, 0.06, 0.6],
  [0, -8.5, 2.2, 1],
  // lounge barat daya, semuanya menghadap TV di tembok depan (z 11,8): sofa dan dua kursi santai (hanya sandaran dan
  // lengan yang menghalangi, dudukannya terbuka dari selatan), meja kopi rendah di depan sofa
  [-8, 8.27, 1.1, 0.15],
  [-9.05, 8.6, 0.125, 0.45],
  [-6.95, 8.6, 0.125, 0.45],
  [-10.8, 8.65, 0.45, 0.12],
  [-5.2, 8.65, 0.45, 0.12],
  [-8, 10.5, 0.65, 0.35],
  // ruang makan dan meja pingpong di sisi timur depan
  [5, 9.5, 1.5, 0.5],
  [9.3, 9.5, 1.3, 0.8],
  // toilet pojok barat laut: dinding timur, dinding selatan (pintu di x -10..-8), sekat, dua kloset
  [-6.5, -9.8, 0.1, 2.2],
  [-11, -7.6, 1, 0.1],
  [-7.25, -7.6, 0.75, 0.1],
  [-9.9, -8.1, 0.06, 0.45], // daun pintu yang terbuka
  [-9.2, -10.9, 0.06, 1.1],
  [-10.6, -11.2, 0.3, 0.35],
  [-7.8, -11.2, 0.3, 0.35],
  // meja printer, counter pantry dan dispenser
  [-11.5, 4, 0.4, 0.65],
  [11.5, 4.5, 0.5, 1.55],
  [11.5, 6.4, 0.25, 0.25],
  // vending dan arcade di dinding timur
  [11.5, -4.65, 0.4, 0.95],
  [11.5, -7.5, 0.4, 1],
  // rak buku: barat di sebelah toilet, timur di tembok belakang, dan timur di tengah
  [-11.7, -5.5, 0.25, 0.85],
  [10.6, -11.65, 0.85, 0.25],
  [11.7, 0, 0.25, 0.85],
]

// ---- tempat pakai ----
// Tempat: x,z,h = posisi dan arah hadap saat sampai (agent disnap ke sini supaya pas di kursi atau kloset, walau
// titiknya di dalam kotak tabrakan); ax,az = titik yang dituju jalan kaki bila berbeda; via = titik yang dilewati dulu;
// pose = 'sit' duduk, 'game' duduk main konsol, 'play' berdiri main, tanpa pose berdiri. Dipakai server (agent) dan
// klien (pemain, tombol F).
export const SPOTS = {
  toilet: [
    { key: 'wc1', x: -10.6, z: -11.1, h: 0, ax: -10.6, az: -10.2, pose: 'sit' },
    { key: 'wc2', x: -7.8, z: -11.1, h: 0, ax: -7.8, az: -10.2, pose: 'sit' },
  ],
  // lounge: semua menghadap TV di tembok depan; dudukan terbuka dari selatan, jadi datang lewat titik di depannya (via)
  sofa: [
    { key: 'sofa1', x: -8.5, z: 8.7, h: 0, via: { x: -8.5, z: 9.6 }, pose: 'sit' },
    { key: 'sofa2', x: -7.5, z: 8.7, h: 0, via: { x: -7.5, z: 9.6 }, pose: 'sit' },
  ],
  game: [
    { key: 'game1', x: -10.8, z: 9.05, h: 0, via: { x: -10.8, z: 10 }, pose: 'game' },
    { key: 'game2', x: -5.2, z: 9.05, h: 0, via: { x: -5.2, z: 10 }, pose: 'game' },
  ],
  // ruang makan: kursi 0,6 dari tepi meja, jadi agent yang radiusnya 0,5 sampai tanpa loncatan
  eat: [
    { key: 'eat1', x: 4.2, z: 8.4, h: 0, pose: 'sit' },
    { key: 'eat2', x: 5.8, z: 8.4, h: 0, pose: 'sit' },
    { key: 'eat3', x: 4.2, z: 10.6, h: Math.PI, pose: 'sit' },
    { key: 'eat4', x: 5.8, z: 10.6, h: Math.PI, pose: 'sit' },
  ],
  // pingpong: dua pemain di ujung meja, saling berhadapan
  pingpong: [
    { key: 'pp1', x: 7.5, z: 9.5, h: Math.PI / 2, pose: 'play' },
    { key: 'pp2', x: 11.1, z: 9.5, h: -Math.PI / 2, pose: 'play' },
  ],
  arcade: [
    { key: 'arc1', x: 10.6, z: -7, h: Math.PI / 2, pose: 'play' },
    { key: 'arc2', x: 10.6, z: -8, h: Math.PI / 2, pose: 'play' },
  ],
  // vending, mesin kopi di counter pantry, dan dispenser air
  coffee: [
    { key: 'vend1', x: 10.6, z: -4, h: Math.PI / 2 },
    { key: 'vend2', x: 10.6, z: -5.3, h: Math.PI / 2 },
    { key: 'pan1', x: 10.5, z: 3.7, h: Math.PI / 2 },
    { key: 'pan2', x: 10.5, z: 5.2, h: Math.PI / 2 },
    { key: 'water', x: 10.75, z: 6.4, h: Math.PI / 2 },
  ],
  // berdiri di depan TV papan task, mengambil cetakan, dan membaca buku di rak
  board: [
    { key: 'board1', x: -9.6, z: -1.8, h: -Math.PI / 2 },
    { key: 'board2', x: -9.6, z: -0.2, h: -Math.PI / 2 },
  ],
  print: [{ key: 'print', x: -10.5, z: 4, h: -Math.PI / 2 }],
  read: [
    { key: 'book1', x: -10.9, z: -5.5, h: -Math.PI / 2 },
    { key: 'book2', x: 10.9, z: 0, h: Math.PI / 2 },
    { key: 'book3', x: 10.6, z: -10.9, h: Math.PI },
  ],
}

// kursi lead saat review; kursi tamu agen nyata ada di SEATS
export const MEET_LEAD = { key: 'meet0', x: -1.6, z: -7.2, h: Math.PI, via: { x: -1.6, z: -6.7 }, pose: 'sit' }

// Tempat yang bisa dicapai dengan jalan lurus dari pintu depan (agen belum punya pencarian rute): kursi sisi
// selatan dan samping meja meeting (duduk, lewat pintu masuk ruang meeting yang lebar), lalu titik berdiri di
// ruang meeting dan di lorong tengah antar kelompok meja. Sisi utara meja sengaja tidak dipakai, karena meja
// menghadang jalan lurus ke sana.
export const SEATS = [
  { key: 'meet1', x: 1.6, z: -7.2, h: Math.PI, via: { x: 1.6, z: -6.7 }, pose: 'sit' },
  { key: 'meet2', x: -2.6, z: -8.5, h: Math.PI / 2, via: { x: -3.6, z: -8.5 }, pose: 'sit' },
  { key: 'meet3', x: 2.6, z: -8.5, h: -Math.PI / 2, via: { x: 3.6, z: -8.5 }, pose: 'sit' },
  { key: 'meet10', x: -1.6, z: -9.8, h: 0, via: { x: -3.4, z: -10.3 }, pose: 'sit' }, { key: 'meet11', x: 1.6, z: -9.8, h: 0, via: { x: 3.4, z: -10.3 }, pose: 'sit' },
  { key: 'meet4', x: 0, z: -6.2, h: Math.PI }, { key: 'meet5', x: -3.4, z: -6.4, h: Math.PI }, { key: 'meet6', x: 3.4, z: -6.4, h: Math.PI },
  { key: 'meet7', x: -1.2, z: 2.5, h: Math.PI }, { key: 'meet8', x: 1.2, z: 2.5, h: Math.PI }, { key: 'meet9', x: 0, z: 5, h: Math.PI },
]
// kursi kerja yang kosong juga bisa diduduki pemain; arah hadap dari sisi sekat tempatnya
const chairSpots = DESK_CHAIRS.map(([x, z]) => {
  const s = SPINES.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a))
  return { key: `chair-${x}-${z}`, x, z, h: z < s ? 0 : Math.PI, pose: 'sit' }
})
// semua tempat yang bisa dipakai pemain: tempat aktivitas agent, kursi meeting, dan kursi kerja yang kosong
export const PLAYER_SPOTS = [...Object.values(SPOTS).flat(), ...SEATS.filter((s) => s.pose), MEET_LEAD, ...chairSpots]

export function clampToRoom(p, half = 0.4) {
  const lim = WALL - half
  p.x = Math.max(-lim, Math.min(lim, p.x))
  p.z = Math.max(-lim, Math.min(lim, p.z))
}

// dorong keluar dari kotak obstacle (media lingkaran radius r)
export function resolveObstacles(p, r = 0.4) {
  for (const [cx, cz, hw, hz] of OBSTACLES) {
    // titik terdekat pada AABB
    const nx = Math.max(cx - hw, Math.min(p.x, cx + hw))
    const nz = Math.max(cz - hz, Math.min(p.z, cz + hz))
    const dx = p.x - nx
    const dz = p.z - nz
    const d2 = dx * dx + dz * dz
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.0001
      // dorong keluar sepanjang normal
      p.x = nx + (dx / d) * r
      p.z = nz + (dz / d) * r
    }
  }
}
