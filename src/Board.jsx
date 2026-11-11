import { useState, useEffect, useRef } from 'react'
import { sfx } from './sfx'

const COLS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
]

const usd = (n) => `$${(n ?? 0).toFixed(2)}`

function StatsPanel({ control }) {
  const [stats, setStats] = useState(null) // null = memuat
  const [failed, setFailed] = useState(false)
  const [cost, setCost] = useState(null) // { today, total, runs }; hanya untuk pemilik komputer
  const { on, call } = control
  useEffect(() => {
    if (!on) return
    const load = () => call('GET', '/api/costs').then((r) => (r.ok ? r.json() : null)).then(setCost).catch(() => {})
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [on, call])
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
      {cost && (
        <p className="note">
          Biaya Claude Code: {usd(cost.today)} hari ini, {usd(cost.total)} dari {cost.runs} sesi tersimpan.
        </p>
      )}
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

const CLAUDE = 'Claude Code'

// Papan Kanban. Task Claude Code tampil untuk semua pemain (judul dan status), tetapi proyek, kemajuan sesi,
// hasil, dan tombol keputusan hanya muncul di komputer pemilik (control.on).
// hidden: kolom tidak digambar, tetapi komponen tetap hidup supaya hitungan di judul tab dan bunyinya jalan terus.
export function Board({ tasks, onDelete, control, hidden = false }) {
  const [open, setOpen] = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [revise, setRevise] = useState(null) // { id, text }
  const [cardError, setCardError] = useState(null) // { id, text }
  const [busy, setBusy] = useState(false)
  const [diffs, setDiffs] = useState({}) // perubahan per id task yang dibuka: { error } atau { files, patch }; dikosongkan saat dialog ditutup
  const closeRef = useRef(null)
  const { on: owner, call: ownerCall } = control

  // dialog hasil task: fokus ke tombol tutup, Escape menutup
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); setDiffs({}) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const closeDialog = () => { setOpen(null); setDiffs({}) }

  // perubahan (diff) task bercabang dimuat saat dialognya dibuka; sebelum jawaban datang tampil "memuat"
  const wantsDiff = Boolean(open && owner && open.mode === 'claude' && open.branch)
  const diff = wantsDiff ? (diffs[open.id] ?? 'loading') : null
  const openId = open?.id
  useEffect(() => {
    if (!wantsDiff) return undefined
    let stale = false
    ownerCall('GET', `/api/tasks/${openId}/diff`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!stale) setDiffs((d) => ({ ...d, [openId]: r.ok ? j : { error: j.error ?? 'Perubahan tidak bisa dimuat' } })) })
      .catch(() => { if (!stale) setDiffs((d) => ({ ...d, [openId]: { error: 'Server tidak terjangkau' } })) })
    return () => { stale = true }
  }, [wantsDiff, openId, ownerCall])

  // jumlah task Claude yang menunggu keputusanmu tampil di judul tab; bunyi saat bertambah (bukan saat halaman dibuka)
  const pending = control.on ? tasks.filter((t) => t.mode === 'claude' && t.status === 'review').length : 0
  const prevPending = useRef(null)
  const baseTitle = useRef(document.title)
  useEffect(() => {
    document.title = pending ? `(${pending}) ${baseTitle.current}` : baseTitle.current
    if (prevPending.current !== null && pending > prevPending.current) sfx.done()
    prevPending.current = pending
  }, [pending])
  useEffect(() => () => { document.title = baseTitle.current }, [])

  const projectName = (id) => control.projects.find((p) => p.id === id)?.name ?? id

  // keputusan pemilik atas task Claude; daftar task diperbarui server lewat sinyal task-update
  const decide = async (id, action, body) => {
    setBusy(true)
    try {
      const r = await control.call('POST', `/api/tasks/${id}/${action}`, body)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setCardError({ id, text: j.error ?? 'Permintaan gagal' }); return false }
      setCardError(null)
      return true
    } catch {
      setCardError({ id, text: 'Server tidak terjangkau' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const sendRevision = async (e, id) => {
    e.preventDefault()
    if (!revise?.text.trim() || busy) return
    if (await decide(id, 'revise', { note: revise.text })) setRevise(null)
  }

  return (
    <>
      <button
        className="btn sm statsbtn"
        aria-pressed={showStats}
        onClick={() => setShowStats((v) => !v)}
      >
        {showStats ? 'Tutup report' : 'Report tim'}
      </button>
      {showStats && <StatsPanel control={control} />}

      {!hidden && <div className={`board${tasks.some((t) => t.mode === 'claude') ? ' wide' : ''}`}>
        {COLS.map((c) => {
          const items = tasks.filter((t) => t.status === c.key)
          return (
            <section key={c.key} className={`col panel ${c.key}`} aria-label={c.label}>
              <h3>{c.label} <span>{items.length}</span></h3>
              {items.length === 0 && <p className="empty">Kosong</p>}
              {items.map((t) => {
                const claude = t.mode === 'claude'
                const mine = claude && control.on
                const session = mine && t.status === 'in_progress' ? control.sessions?.find((s) => s.id === t.session_id) : null
                const subagents = (session?.subagents ?? []).filter((x) => x.state === 'running').map((x) => x.type)
                const canOpen = t.status === 'done'
                const canDelete = t.status === 'todo' || t.status === 'done' || (mine && t.status === 'review')
                return (
                  <div
                    key={t.id}
                    className={`tcard${canOpen ? ' open' : ''}${claude ? ' claude' : ''}`}
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
                      {t.status === 'in_progress' && !claude && (
                        <div className="bar"><i style={{ transform: `scaleX(${Math.min(1, t.progress / t.est)})` }} /></div>
                      )}
                      {t.agent_id && <div className="who">@{t.agent_id}</div>}
                      {claude && <div className="who">{CLAUDE}{mine && t.project_id ? `, ${projectName(t.project_id)}` : ''}{mine && t.cost > 0 ? `, ${usd(t.cost)}` : ''}</div>}
                      {claude && t.status === 'in_progress' && (
                        <div className="tlive">
                          {session
                            ? `${session.activity}${session.tools ? `, ${session.tools} tool` : ''}${subagents.length ? `. Subagent: ${subagents.join(', ')}` : ''}`
                            : 'Sedang dikerjakan'}
                        </div>
                      )}
                      {claude && t.status === 'review' && t.output && <div className="tnote">{t.output}</div>}
                      {mine && t.branch && t.status === 'review' && <div className="tnote">Cabang {t.branch}</div>}
                      {mine && t.status === 'review' && (
                        <div className="tact">
                          <button className="btn sm go" disabled={busy} onClick={() => decide(t.id, 'approve')}>Setujui</button>
                          {t.session_id && (
                            <button className="btn sm" aria-expanded={revise?.id === t.id} onClick={() => setRevise(revise?.id === t.id ? null : { id: t.id, text: '' })}>
                              Revisi
                            </button>
                          )}
                          <button className="btn sm" disabled={busy} onClick={() => decide(t.id, 'retry')}>Ulangi</button>
                          {(t.detail || t.branch) && <button className="btn sm" aria-label={`Lihat detail: ${t.title}`} onClick={() => setOpen(t)}>Detail</button>}
                          {t.branch && (
                            <button className="btn sm go full" disabled={busy} title="Gabungkan cabang task ke cabang aktif proyek" onClick={() => decide(t.id, 'merge')}>
                              Gabungkan
                            </button>
                          )}
                        </div>
                      )}
                      {mine && revise?.id === t.id && (
                        <form className="trev" onSubmit={(e) => sendRevision(e, t.id)}>
                          <textarea
                            className="field"
                            rows={2}
                            value={revise.text}
                            maxLength={4000}
                            onChange={(e) => setRevise({ id: t.id, text: e.target.value })}
                            placeholder="Apa yang perlu diperbaiki"
                            aria-label={`Catatan revisi: ${t.title}`}
                          />
                          <button type="submit" className="btn sm go" disabled={busy || !revise.text.trim()}>Kirim revisi</button>
                        </form>
                      )}
                      {cardError?.id === t.id && <div role="alert" className="tnote bad">{cardError.text}</div>}
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
      </div>}

      {open && (
        <div className="backdrop" onClick={closeDialog}>
          <div className="dialog panel" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()}>
            <h2>{open.title}</h2>
            <div className="meta">
              {open.mode === 'claude' ? CLAUDE : `@${open.agent_id}`}, {open.finished_at
                ? `selesai ${new Date(open.finished_at).toLocaleTimeString()}`
                : open.status === 'review' ? 'menunggu keputusan' : 'belum tercatat'}
            </div>
            <pre>{(open.mode === 'claude' && open.detail) || open.output || '(tidak ada output)'}</pre>
            {diff && (
              <section aria-label="Perubahan">
                <h3>Perubahan{diff.branch ? ` di ${diff.branch}` : ''}</h3>
                {diff === 'loading' && <p className="empty">Memuat perubahan.</p>}
                {diff.error && <p role="alert" className="note bad">{diff.error}</p>}
                {diff.files?.length === 0 && <p className="empty">Tidak ada berkas yang berubah.</p>}
                {diff.files?.length > 0 && (
                  <>
                    <ul className="dfiles">
                      {diff.files.map((x) => <li key={x.path}>{x.path} <small>{x.added == null ? 'biner' : `+${x.added} -${x.removed}`}</small></li>)}
                    </ul>
                    <pre className="patch" tabIndex={0} aria-label="Isi perubahan">
                      {diff.patch.split('\n').map((l, i) => (
                        <span key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : undefined}>{l}{'\n'}</span>
                      ))}
                    </pre>
                    {diff.truncated && <p className="note">Patch dipotong karena terlalu besar. Lihat selengkapnya dengan git diff di proyek.</p>}
                  </>
                )}
              </section>
            )}
            <button ref={closeRef} className="btn go" onClick={closeDialog}>Tutup</button>
          </div>
        </div>
      )}
    </>
  )
}

// Form task. Pilihan "Claude Code" hanya ada di komputer pemilik, dan butuh proyek terdaftar.
export function TaskForm({ onAdd, control }) {
  const [title, setTitle] = useState('')
  const [est, setEst] = useState(6)
  const [who, setWho] = useState('sim') // 'sim' | 'claude'
  const [projectId, setProjectId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kit, setKit] = useState(null) // peran (subagent kit); null: belum dimuat
  const [picked, setPicked] = useState(null) // null: semua peran; selain itu daftar nama yang dipilih

  const canClaude = control.on && control.projects.length > 0
  const claude = who === 'claude' && canClaude
  const chosen = control.projects.some((p) => p.id === projectId) ? projectId : (control.projects[0]?.id ?? '')

  const loadKit = control.call
  useEffect(() => {
    if (!claude || kit) return
    loadKit('GET', '/api/kit').then((r) => (r.ok ? r.json() : [])).then(setKit).catch(() => setKit([]))
  }, [claude, kit, loadKit])

  const toggleRole = (name) => {
    const now = picked ?? kit.map((k) => k.name)
    setPicked(now.includes(name) ? now.filter((n) => n !== name) : [...now, name])
  }

  const addClaude = async () => {
    try {
      const r = await control.call('POST', '/api/tasks/claude', { title: title.trim(), projectId: chosen, prompt, ...(picked && { roles: picked }) })
      if (r.ok) return { ok: true }
      const body = await r.json().catch(() => ({}))
      return { ok: false, error: body.error ?? 'task gagal ditambahkan' }
    } catch {
      return { ok: false, error: 'server tidak terjangkau' }
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    const res = claude ? await addClaude() : await onAdd(title.trim(), est)
    setBusy(false)
    // gagal: judul tetap di kolom supaya tidak perlu diketik ulang
    if (res?.ok === false) return setError(res.error)
    setError('')
    setTitle('')
    setPrompt('')
    setPicked(null)
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
      {control.on && (
        <select className="field" value={claude ? 'claude' : 'sim'} onChange={(e) => setWho(e.target.value)} aria-label="Dikerjakan oleh">
          <option value="sim">Agent simulasi</option>
          <option value="claude" disabled={!canClaude}>{canClaude ? CLAUDE : `${CLAUDE} (tambah proyek dulu)`}</option>
        </select>
      )}
      {claude ? (
        <>
          <select className="field" value={chosen} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyek untuk Claude Code">
            {control.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <textarea
            className="field"
            rows={2}
            value={prompt}
            maxLength={4000}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Instruksi rinci (kosong: pakai judul)"
            aria-label="Instruksi untuk Claude Code"
          />
          {kit?.length > 0 && (
            <details className="roles panel">
              <summary>Peran subagent: {picked ? `${picked.length} dari ${kit.length}` : 'semua'}</summary>
              {kit.map((k) => (
                <label key={k.name} className="pcheck" title={k.description}>
                  <input type="checkbox" checked={!picked || picked.includes(k.name)} onChange={() => toggleRole(k.name)} />
                  {k.name}{k.writes ? ' (mengubah file)' : ''}
                </label>
              ))}
            </details>
          )}
        </>
      ) : (
        <select className="field" value={est} onChange={(e) => setEst(Number(e.target.value))} aria-label="Estimasi pengerjaan">
          {[3, 6, 12, 20].map((s) => (
            <option key={s} value={s}>{s} detik</option>
          ))}
        </select>
      )}
      <button type="submit" className="btn go" disabled={busy}>Tambah task</button>
    </form>
  )
}
