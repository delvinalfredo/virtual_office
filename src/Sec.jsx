import { useState } from 'react'

const load = (id, fallback) => {
  try {
    const v = localStorage.getItem(`kantor-sec-${id}`)
    return v === null ? fallback : v === 'open'
  } catch { return fallback }
}

// Bagian panel yang judulnya bisa dilipat. Pilihan tiap bagian diingat di localStorage.
// keep: isi tetap hidup saat dilipat (untuk form, supaya ketikan tidak hilang).
export function Sec({ id, className = '', label, title, count, defaultOpen = true, keep = false, children }) {
  const [open, setOpen] = useState(() => load(id, defaultOpen))
  const toggle = () => setOpen((v) => {
    try { localStorage.setItem(`kantor-sec-${id}`, v ? 'closed' : 'open') } catch { /* abaikan */ }
    return !v
  })
  return (
    <section className={`sec ${className}${open ? '' : ' shut'}`} aria-label={label}>
      <h3>
        <button type="button" className="sechead" aria-expanded={open} onClick={toggle}>
          <i aria-hidden="true">{open ? '▾' : '▸'}</i>
          <span className="t">{title}</span>
          {count != null && <span className="n">{count}</span>}
        </button>
      </h3>
      {keep ? <div hidden={!open}>{children}</div> : open && children}
    </section>
  )
}
