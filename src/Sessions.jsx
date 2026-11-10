import { useState } from 'react'

const STATE_LABEL = { running: 'Berjalan', stopping: 'Menghentikan', done: 'Selesai', error: 'Gagal', stopped: 'Dihentikan' }

// Panel sesi Claude Code: kelola proyek, tulis tugas, lihat dan hentikan sesi yang berjalan.
// Data dan token datang dari useControl; di luar komputer yang menjalankan server panel ini tidak tampil.
export function Sessions({ control }) {
  const { on, call, projects, setProjects, sessions: list, error, setError, reload } = control
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [pname, setPname] = useState('')
  const [ppath, setPpath] = useState('')
  const [pchecks, setPchecks] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [cont, setCont] = useState(null) // { id, text }
  const [hist, setHist] = useState(null) // riwayat sesi tersimpan; null: belum dibuka
  // pilihan di form tugas mengikuti daftar: bila belum dipilih atau proyeknya dihapus, pakai yang pertama
  const chosen = projects.some((p) => p.id === projectId) ? projectId : (projects[0]?.id ?? '')

  if (!on) return null

  const act = async (method, url, body) => {
    setBusy(true)
    try {
      const r = await call(method, url, body)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'Permintaan gagal'); return false }
      setError('')
      reload()
      return true
    } catch {
      setError('Server tidak terjangkau')
      return false
    } finally {
      setBusy(false)
    }
  }

  // tambah atau hapus proyek: server menjawab dengan daftar terbaru, jadi pilihan di form tugas ikut diperbarui
  const changeProjects = async (method, url, body) => {
    setBusy(true)
    try {
      const r = await call(method, url, body)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'Permintaan gagal'); return false }
      setError('')
      setProjects(j)
      return true
    } catch {
      setError('Server tidak terjangkau')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addProject = async (e) => {
    e.preventDefault()
    if (!pname.trim() || !ppath.trim() || busy) return
    if (await changeProjects('POST', '/api/projects', { name: pname, path: ppath, checks: pchecks })) { setPname(''); setPpath(''); setPchecks(false) }
  }

  const start = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || busy) return
    if (await act('POST', '/api/sessions', { projectId: chosen, prompt })) setPrompt('')
  }

  const resume = async (e, id) => {
    e.preventDefault()
    if (!cont?.text.trim() || busy) return
    if (await act('POST', `/api/sessions/${id}/continue`, { prompt: cont.text })) setCont(null)
  }

  const loadHistory = () => {
    call('GET', '/api/history')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then(setHist)
      .catch(() => setError('Riwayat tidak bisa dimuat.'))
  }

  const running = (list ?? []).filter((s) => s.state === 'running' || s.state === 'stopping').length

  return (
    <>
      <button className="btn sm sessbtn" aria-pressed={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Tutup sesi' : `Sesi Claude${running ? ` (${running})` : ''}`}
      </button>
      {open && (
        <section className="sessions panel" aria-label="Sesi Claude Code">
          <h2>Sesi Claude Code</h2>
          <details className="pmanage" open={projects.length === 0}>
            <summary>Kelola proyek</summary>
            {projects.length === 0 ? (
              <p className="empty">Belum ada proyek. Isi nama dan alamat lengkap foldernya.</p>
            ) : (
              <ul className="plist">
                {projects.map((p) => (
                  <li key={p.id} className="prow">
                    <span>
                      {p.name}
                      <small>{p.path}</small>
                      <label className="pcheck">
                        <input
                          type="checkbox"
                          checked={p.checks}
                          disabled={busy}
                          onChange={(e) => changeProjects('PATCH', `/api/projects/${encodeURIComponent(p.id)}`, { checks: e.target.checked })}
                        />
                        Izinkan tes dan build
                      </label>
                    </span>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busy}
                      aria-label={`Hapus proyek ${p.name} dari daftar`}
                      onClick={() => changeProjects('DELETE', `/api/projects/${encodeURIComponent(p.id)}`)}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form className="sform" onSubmit={addProject}>
              <input
                className="field"
                value={pname}
                maxLength={40}
                onChange={(e) => setPname(e.target.value)}
                placeholder="Nama proyek"
                aria-label="Nama proyek"
              />
              <input
                className="field"
                value={ppath}
                maxLength={500}
                onChange={(e) => setPpath(e.target.value)}
                placeholder="Alamat folder, misalnya D:/Kodingan/proyek-satu"
                aria-label="Alamat folder"
              />
              <label className="pcheck">
                <input type="checkbox" checked={pchecks} onChange={(e) => setPchecks(e.target.checked)} />
                Izinkan tes dan build
              </label>
              <button type="submit" className="btn sm" disabled={busy || !pname.trim() || !ppath.trim()}>Tambah proyek</button>
            </form>
            <p className="note">
              Claude membaca dan mengedit file di folder ini. Perintah shell hanya npm test dan npm run build, dan hanya bila dicentang.
              Hapus hanya mencabut dari daftar, foldernya tetap ada.
            </p>
          </details>
          {projects.length > 0 && (
            <form className="sform" onSubmit={start}>
              <select className="field" value={chosen} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyek">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <textarea
                className="field"
                rows={3}
                value={prompt}
                maxLength={4000}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tugas untuk Claude Code di proyek ini"
                aria-label="Tugas"
              />
              <button type="submit" className="btn go" disabled={busy || !prompt.trim()}>Jalankan</button>
            </form>
          )}
          {error && <div role="alert" className="note bad">{error}</div>}
          {list === null && !error && <p className="empty">Memuat sesi.</p>}
          {list?.length === 0 && <p className="empty">Belum ada sesi.</p>}
          <ul className="slist">
            {list?.map((s) => (
              <li key={s.id} className="sess panel">
                <div className="shead">
                  <b>{s.project}</b>
                  <span className={`chip ${s.state}`}>{STATE_LABEL[s.state] ?? s.state}</span>
                </div>
                <div className="sact">{s.activity}{s.tools ? `, ${s.tools} tool` : ''}{s.runs > 1 ? `, tugas ke-${s.runs}` : ''}</div>
                {s.result?.denials > 0 && <div className="note">{s.result.denials} izin ditolak. Tool seperti perintah shell tidak diizinkan.</div>}
                {s.state === 'error' && s.error && <div className="note bad">{s.error}</div>}
                {s.lastText && (
                  <details>
                    <summary>Hasil terakhir</summary>
                    <pre>{s.lastText}</pre>
                  </details>
                )}
                <div className="sbtns">
                  {s.state === 'running' && <button className="btn sm danger" disabled={busy} onClick={() => act('POST', `/api/sessions/${s.id}/stop`)}>Hentikan</button>}
                  {s.canContinue && <button className="btn sm" onClick={() => setCont(cont?.id === s.id ? null : { id: s.id, text: '' })}>Lanjutkan</button>}
                </div>
                {cont?.id === s.id && (
                  <form className="sform" onSubmit={(e) => resume(e, s.id)}>
                    <textarea
                      className="field"
                      rows={2}
                      value={cont.text}
                      maxLength={4000}
                      onChange={(e) => setCont({ id: s.id, text: e.target.value })}
                      placeholder="Lanjutkan percakapan sesi ini"
                      aria-label="Lanjutkan sesi"
                    />
                    <button type="submit" className="btn go" disabled={busy || !cont.text.trim()}>Kirim</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <details className="pmanage" onToggle={(e) => { if (e.currentTarget.open) loadHistory() }}>
            <summary>Riwayat sesi</summary>
            {hist === null && <p className="empty">Memuat riwayat.</p>}
            {hist?.length === 0 && <p className="empty">Belum ada sesi tersimpan.</p>}
            <ul className="slist">
              {hist?.map((h) => {
                const types = [...new Set(JSON.parse(h.subagents || '[]'))]
                return (
                  <li key={h.id} className="sess panel">
                    <div className="shead">
                      <b>{h.project}</b>
                      <span className={`chip ${h.state}`}>{STATE_LABEL[h.state] ?? h.state}</span>
                    </div>
                    <div className="sact">
                      {new Date(h.ended_at).toLocaleString()}, {h.tools} tool{h.cost > 0 ? `, $${h.cost.toFixed(2)}` : ''}
                      {types.length ? `, subagent: ${types.join(', ')}` : ''}
                    </div>
                    {(h.result || h.error) && (
                      <details>
                        <summary>Hasil</summary>
                        <pre>{h.error || h.result}</pre>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          </details>
        </section>
      )}
    </>
  )
}
