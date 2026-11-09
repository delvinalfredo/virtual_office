import { useState, useEffect } from 'react'

const COLS = [
  { key: 'todo', label: 'To Do', color: '#8e44ad' },
  { key: 'in_progress', label: 'In Progress', color: '#e67e22' },
  { key: 'review', label: 'Review', color: '#f1c40f' },
  { key: 'done', label: 'Done', color: '#27ae60' },
]

function StatsPanel() {
  const [stats, setStats] = useState([])
  useEffect(() => {
    const load = () => fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => {})
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [])
  const max = Math.max(1, ...stats.map((s) => s.done))
  return (
    <div style={{
      position: 'fixed', top: 12, left: 12, zIndex: 25, width: 230,
      background: 'rgba(20,24,32,0.85)', borderRadius: 10, padding: 10,
      color: '#fff', fontFamily: 'sans-serif', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📊 Report Tim</div>
      {stats.map((s) => (
        <div key={s.id} style={{ marginBottom: 7 }}>
          <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
            <span>{s.id}</span>
            <span style={{ opacity: 0.7 }}>{s.done} task · ⌀{s.avgSec}s</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(s.done / max) * 100}%`, height: '100%', background: '#3498db' }} />
          </div>
        </div>
      ))}
      {stats.length === 0 && <div style={{ fontSize: 11, opacity: 0.5 }}>belum ada data</div>}
    </div>
  )
}

export function Board({ tasks, onDelete }) {
  const [open, setOpen] = useState(null)
  const [showStats, setShowStats] = useState(false)
  return (
    <>
      <button
        onClick={() => setShowStats((v) => !v)}
        style={{
          position: 'fixed', top: 12, left: 12, zIndex: 24, padding: '7px 12px',
          borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: !showStats ? 'rgba(20,24,32,0.85)' : '#2ecc71',
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif',
        }}
      >
        {showStats ? '✕ tutup report' : '📊 Report tim'}
      </button>
      {showStats && <StatsPanel />}

      <div style={{
        position: 'fixed', top: 12, right: 12, width: 400,
        display: 'flex', gap: 6, fontFamily: 'sans-serif', zIndex: 10,
      }}>
        {COLS.map((c) => {
          const items = tasks.filter((t) => t.status === c.key)
          return (
            <div key={c.key} style={{
              flex: 1, background: 'rgba(20,24,32,0.85)', borderRadius: 8, padding: 7,
              color: '#fff', backdropFilter: 'blur(4px)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.color, marginBottom: 6 }}>
                {c.label} <span style={{ opacity: 0.7 }}>({items.length})</span>
              </div>
              {items.map((t) => (
                <div
                  key={t.id}
                  onClick={() => t.status === 'done' && setOpen(t)}
                  style={{
                    fontSize: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                    padding: '4px 6px', marginBottom: 4,
                    cursor: t.status === 'done' && t.output ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    {t.status === 'in_progress' && (
                      <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 4, height: 4, overflow: 'hidden', marginTop: 2 }}>
                        <div style={{
                          width: `${Math.min(100, (t.progress / t.est) * 100)}%`,
                          height: '100%', background: '#f39c12', transition: 'width 0.3s',
                        }} />
                      </div>
                    )}
                    {t.agent_id && <div style={{ fontSize: 8, opacity: 0.6 }}>@{t.agent_id}</div>}
                  </div>
                  {t.status === 'todo' && (
                    <button
                      title="hapus task"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(t.id) }}
                      style={{
                        border: 'none', background: 'rgba(231,76,60,0.8)', color: '#fff',
                        borderRadius: 4, width: 16, height: 16, fontSize: 10, lineHeight: '16px',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* preview hasil task done */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'sans-serif',
          }}
          onClick={() => setOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420, maxHeight: '70vh', overflow: 'auto',
              background: '#141820', borderRadius: 12, padding: 18, color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{open.title}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>
              @{open.agent_id} · selesai {open.finished_at ? new Date(open.finished_at).toLocaleTimeString() : '-'}
            </div>
            <pre style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12,
              fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'ui-monospace, monospace',
            }}>
              {open.output || '(tidak ada output)'}
            </pre>
            <button
              onClick={() => setOpen(null)}
              style={{
                marginTop: 12, padding: '7px 14px', borderRadius: 8, border: 'none',
                background: '#27ae60', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Tutup
            </button>
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

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    await onAdd(title.trim(), est)
    setTitle('')
    setBusy(false)
  }

  return (
    <form onSubmit={submit} style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 10,
      display: 'flex', gap: 6, fontFamily: 'sans-serif',
    }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task baru, mis: fix bug login"
        style={{
          width: 220, padding: '8px 10px', borderRadius: 8, border: '1px solid #555',
          background: 'rgba(20,24,32,0.85)', color: '#fff', fontSize: 13,
        }}
      />
      <select
        value={est}
        onChange={(e) => setEst(Number(e.target.value))}
        style={{
          padding: '8px', borderRadius: 8, border: '1px solid #555',
          background: 'rgba(20,24,32,0.85)', color: '#fff',
        }}
      >
        {[3, 6, 12, 20].map((s) => (
          <option key={s} value={s}>{s}s</option>
        ))}
      </select>
      <button type="submit" disabled={busy} style={{
        padding: '8px 14px', borderRadius: 8, border: 'none',
        background: '#27ae60', color: '#fff', fontWeight: 700, cursor: 'pointer',
      }}>
        +
      </button>
    </form>
  )
}
