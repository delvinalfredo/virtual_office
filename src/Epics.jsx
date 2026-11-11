import { useState, useEffect } from 'react'
import { Sec } from './Sec'

const usd = (n) => `$${(n ?? 0).toFixed(2)}`
const STAGE = {
  planning: 'Tech Lead sedang menyusun rencana',
  planned: 'Rencana jadi, menunggu kamu jalankan',
  running: 'Tim sedang mengerjakan',
  paused: 'Berhenti, anggaran habis',
  review: 'Butuh keputusanmu',
  done: 'Sudah digabung ke proyek',
  failed: 'Rencana gagal',
}

// Keadaan satu task di dalam pekerjaan besar, dalam kata yang dipakai papan
function taskState(t, all) {
  if (t.status === 'done') return 'selesai'
  if (t.status === 'review') return 'butuh keputusanmu'
  if (t.status === 'in_progress') return t.checks === 'jalan' ? 'diperiksa server' : t.attempts > 0 ? `perbaikan ke-${t.attempts}` : 'dikerjakan'
  const waiting = t.deps.map((id) => all.find((x) => x.id === id)).filter((x) => x && x.status !== 'done').map((x) => x.key)
  return waiting.length ? `menunggu ${waiting.join(', ')}` : 'antre'
}

// Pekerjaan besar: satu permintaan yang dipecah perencana menjadi beberapa task. Hanya tampil di komputer pemilik.
// reloadKey berubah tiap daftar task atau sesi berubah, jadi daftar ini ikut dimuat ulang tanpa polling.
export function Epics({ control, reloadKey, onOpen, onPending, hidden = false }) {
  const { on, call, projects } = control
  const [list, setList] = useState(null) // null: memuat
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // { id, text }
  const [confirm, setConfirm] = useState(null) // id pekerjaan yang diminta dibuang
  const [budget, setBudget] = useState({}) // anggaran baru per id pekerjaan yang berhenti

  useEffect(() => {
    if (!on) return undefined
    let stale = false
    call('GET', '/api/epics')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then((l) => { if (!stale) { setList(l); setFailed(false) } })
      .catch(() => { if (!stale) setFailed(true) })
    return () => { stale = true }
  }, [on, call, reloadKey])

  const waiting = (list ?? []).filter((e) => e.status === 'review' || e.status === 'planned' || e.status === 'paused').length
  useEffect(() => { onPending?.(waiting) }, [waiting, onPending])

  if (hidden || !on || (!failed && !list?.length)) return null

  const act = async (id, method, url, body) => {
    setBusy(true)
    try {
      const r = await call(method, url, body)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError({ id, text: j.error ?? 'Permintaan gagal' }); return false }
      setError(null)
      return true
    } catch {
      setError({ id, text: 'Server tidak terjangkau' })
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sec id="epics" className="epics" label="Pekerjaan besar" title="Pekerjaan besar" count={list?.length ?? 0}>
      {failed && <p role="alert" className="note bad">Daftar pekerjaan besar tidak termuat. Periksa apakah server masih jalan.</p>}
      {list?.map((e) => {
        const done = e.tasks.filter((t) => t.status === 'done').length
        return (
          <div key={e.id} className="tcard claude">
            <div className="body">
              <div className="title">{e.title}</div>
              <div className="who">{projects.find((p) => p.id === e.project_id)?.name ?? e.project_id}, {usd(e.cost)} dari {usd(e.budget)}</div>
              <div className="tnote">{STAGE[e.status] ?? e.status}{e.tasks.length ? `, ${done} dari ${e.tasks.length} task selesai` : ''}</div>
              {e.note && e.status !== 'running' && <div className="tlive">{e.note}</div>}
              {e.status === 'failed' && e.detail && <div className="tnote bad">{e.detail}</div>}
              {e.tasks.length > 0 && e.status !== 'done' && (
                <ul className="esteps">
                  {e.tasks.map((t) => <li key={t.id} className={t.status}><span>{t.title}</span><small>{taskState(t, e.tasks)}</small></li>)}
                </ul>
              )}
              <div className="tact" hidden={!['planned', 'failed', 'review'].includes(e.status)}>
                {e.status === 'planned' && <button className="btn sm go full" disabled={busy} onClick={() => act(e.id, 'POST', `/api/epics/${e.id}/run`)}>Jalankan rencana</button>}
                {e.status === 'failed' && e.tasks.length === 0 && <button className="btn sm full" disabled={busy} onClick={() => act(e.id, 'POST', `/api/epics/${e.id}/replan`)}>Rencanakan ulang</button>}
                {e.status === 'review' && (
                  <>
                    <button className="btn sm" onClick={() => onOpen(e)}>Lihat perubahan</button>
                    <button className="btn sm go" disabled={busy} title="Gabungkan cabang pekerjaan ke cabang aktif proyek" onClick={() => act(e.id, 'POST', `/api/epics/${e.id}/merge`)}>Gabungkan</button>
                  </>
                )}
              </div>
              {e.status === 'paused' && (
                <form className="trev" onSubmit={(ev) => { ev.preventDefault(); act(e.id, 'POST', `/api/epics/${e.id}/run`, { budget: Number(budget[e.id] ?? Math.min(200, e.budget * 2)) }) }}>
                  <label className="pcheck" htmlFor={`anggaran-${e.id}`}>Anggaran baru (USD)</label>
                  <input
                    id={`anggaran-${e.id}`}
                    className="field"
                    type="number"
                    min={0.5}
                    max={200}
                    step={0.5}
                    value={budget[e.id] ?? Math.min(200, e.budget * 2)}
                    onChange={(ev) => setBudget({ ...budget, [e.id]: ev.target.value })}
                  />
                  <button type="submit" className="btn sm go" disabled={busy}>Lanjutkan</button>
                </form>
              )}
              {confirm === e.id && (
                <div className="trev" role="group" aria-label={`Buang pekerjaan ${e.title}`}>
                  <div className="tnote">Buang "{e.title}" beserta {e.tasks.length} task dan cabang kerjanya? Yang sudah digabung ke proyek tetap ada.</div>
                  <div className="tact">
                    <button className="btn sm danger" disabled={busy} onClick={async () => { if (await act(e.id, 'DELETE', `/api/epics/${e.id}`)) setConfirm(null) }}>Buang</button>
                    <button className="btn sm" onClick={() => setConfirm(null)}>Batal</button>
                  </div>
                </div>
              )}
              {error?.id === e.id && <div role="alert" className="tnote bad">{error.text}</div>}
            </div>
            <button className="x" title="Buang pekerjaan" aria-label={`Buang pekerjaan: ${e.title}`} aria-expanded={confirm === e.id} onClick={() => setConfirm(confirm === e.id ? null : e.id)}>×</button>
          </div>
        )
      })}
    </Sec>
  )
}

// Form pekerjaan besar: bagian dari TaskForm saat "Tim Claude" dipilih.
export function EpicFields({ projects, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <>
      <select className="field" value={value.projectId} onChange={(e) => set({ projectId: e.target.value })} aria-label="Proyek untuk tim">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <textarea
        className="field"
        rows={4}
        value={value.prompt}
        maxLength={3000}
        onChange={(e) => set({ prompt: e.target.value })}
        placeholder="Apa yang mau dibuat: tujuan, layar, data, batasan"
        aria-label="Penjelasan pekerjaan untuk tim"
      />
      <label className="pcheck" htmlFor="anggaran-baru">Anggaran seluruh pekerjaan (USD)</label>
      <input id="anggaran-baru" className="field" type="number" min={0.5} max={200} step={0.5} value={value.budget} onChange={(e) => set({ budget: e.target.value })} />
      <label className="pcheck">
        <input type="checkbox" checked={value.auto} onChange={(e) => set({ auto: e.target.checked })} />
        Langsung kerjakan setelah rencana jadi
      </label>
    </>
  )
}
