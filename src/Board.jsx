import { useState, useEffect, useRef } from 'react'

const COLS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

function StatsPanel() {
  const [stats, setStats] = useState(null) // null = memuat
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const load = () => fetch('/api/stats').then((r) => r.json()).then((d) => { setStats(d); setFailed(false) }).catch(() => setFailed(true))
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [])
  const max = Math.max(1, ...(stats ?? []).map((s) => s.done))
  return (
    <section className="stats panel" aria-label="Report tim">
      <h2>Report tim</h2>
      {failed && <p className="empty">Server tidak terjangkau, mencoba lagi.</p>}
      {!failed && stats === null && <p className="empty">Memuat data.</p>}
      {stats?.length === 0 && <p className="empty">Belum ada data.</p>}
      {stats?.map((s) => (
        <div key={s.id} className="srow">
          <div>
            <span>{s.id}</span>
            <span>{s.done} task, rata-rata {s.avgSec} detik</span>
          </div>
          <div className="bar"><i style={{ transform: `scaleX(${s.done / max})` }} /></div>
        </div>
      ))}
    </section>
  )
}

export function Board({ tasks, onDelete }) {
  const [open, setOpen] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const closeRef = useRef(null)

  // dialog hasil task: fokus ke tombol tutup, Escape menutup
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        className="btn sm statsbtn"
        aria-pressed={showStats}
        onClick={() => setShowStats((v) => !v)}
      >
        {showStats ? 'Tutup report' : 'Report tim'}
      </button>
      {showStats && <StatsPanel />}

      <div className="board">
        {COLS.map((c) => {
          const items = tasks.filter((t) => t.status === c.key)
          return (
            <section key={c.key} className={`col panel ${c.key}`} aria-label={c.label}>
              <h3>{c.label} <span>{items.length}</span></h3>
              {items.length === 0 && <p className="empty">Kosong</p>}
              {items.map((t) => {
                const canOpen = t.status === 'done'
                const canDelete = t.status === 'todo' || t.status === 'done'
                return (
                  <div
                    key={t.id}
                    className={`tcard${canOpen ? ' open' : ''}`}
                    {...(canOpen && {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `Lihat hasil: ${t.title}`,
                      onClick: () => setOpen(t),
                      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(t) } },
                    })}
                  >
                    <div className="body">
                      <div className="title">{t.title}</div>
                      {t.status === 'in_progress' && (
                        <div className="bar"><i style={{ transform: `scaleX(${Math.min(1, t.progress / t.est)})` }} /></div>
                      )}
                      {t.agent_id && <div className="who">@{t.agent_id}</div>}
                    </div>
                    {canDelete && (
                      <button
                        className="x"
                        title="Hapus task"
                        aria-label={`Hapus task: ${t.title}`}
                        onClick={(e) => { e.stopPropagation(); onDelete?.(t.id) }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>

      {open && (
        <div className="backdrop" onClick={() => setOpen(null)}>
          <div className="dialog panel" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()}>
            <h2>{open.title}</h2>
            <div className="meta">
              @{open.agent_id}, selesai {open.finished_at ? new Date(open.finished_at).toLocaleTimeString() : 'belum tercatat'}
            </div>
            <pre>{open.output || '(tidak ada output)'}</pre>
            <button ref={closeRef} className="btn go" onClick={() => setOpen(null)}>Tutup</button>
          </div>
        </div>
      )}
    </>
  )
}

export function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [est, setEst] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    const res = await onAdd(title.trim(), est)
    setBusy(false)
    // gagal: judul tetap di kolom supaya tidak perlu diketik ulang
    if (res?.ok === false) return setError(res.error)
    setError('')
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="taskform">
      {error && <div role="alert" className="err panel">Task tidak masuk: {error}</div>}
      <input
        className="field title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task baru, mis: fix bug login"
        aria-label="Judul task baru"
        maxLength={80}
      />
      <select className="field" value={est} onChange={(e) => setEst(Number(e.target.value))} aria-label="Estimasi pengerjaan">
        {[3, 6, 12, 20].map((s) => (
          <option key={s} value={s}>{s} detik</option>
        ))}
      </select>
      <button type="submit" className="btn go" disabled={busy}>Tambah task</button>
    </form>
  )
}
