// Jumlah token ringkas: 950, 12 rb, 1,3 jt
export const tok = (n = 0) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n))
