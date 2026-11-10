import { useState, useEffect, useCallback } from 'react'

const STATE_LABEL = { running: 'Berjalan', stopping: 'Menghentikan', done: 'Selesai', error: 'Gagal', stopped: 'Dihentikan' }

// Panel sesi Claude Code: pilih proyek terdaftar, tulis tugas, lihat dan hentikan sesi yang berjalan.
// Hanya muncul di komputer yang menjalankan server (pemain lain dari jaringan mendapat 403 dan tidak melihatnya).
export function Sessions({ tick }) {
  const [ctl, setCtl] = useState(null) // null: memuat, 'off': tidak tersedia, objek: { token, projects }
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState([]) // { id, name, path }; diubah lewat form "Kelola proyek"
  const [projectId, setProjectId] = useState('')
  const [pname, setPname] = useState('')
  const [ppath, setPpath] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [cont, setCont] = useState(null) // { id, text }

  useEffect(() => {
    fetch('/api/control')
      .then((r) => (r.ok ? r.json() : 'off'))
      .then((c) => { setCtl(c); if (c !== 'off' && c.projects[0]) setProjectId(c.projects[0].id) })
      .catch(() => setCtl('off'))
  }, [])

  const token = ctl && ctl !== 'off' ? ctl.token : null
  const call = useCallback((method, url, body) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Kantor-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  }), [token])

  const load = useCallback(() => {
    if (!token) return
    call('GET', '/api/sessions')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then((l) => { setList(l); setError('') })
      .catch(() => setError('Server tidak menjawab atau menolak permintaan.'))
  }, [token, call])

  useEffect(() => {
    if (!token) return
    call('GET', '/api/projects')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then(setProjects)
      .catch(() => setError('Daftar proyek tidak bisa dimuat.'))
  }, [token, call])

  // muat saat panel dibuka dan tiap server memberi sinyal bahwa sesi berubah
  useEffect(() => { if (open) load() }, [open, tick, load])

  if (ctl === null || ctl === 'off') return null

  const act = async (method, url, body) => {
    setBusy(true)
    try {
      const r = await call(method, url, body)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'Permintaan gagal'); return false }
      setError('')
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
      setProjectId((cur) => (j.some((p) => p.id === cur) ? cur : (j[0]?.id ?? '')))
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
    if (await changeProjects('POST', '/api/projects', { name: pname, path: ppath })) { setPname(''); setPpath('') }
  }

  const start = async (e) => {
    e.preventDefault()
    if (!prompt.trim() || busy) return
    if (await act('POST', '/api/sessions', { projectId, prompt })) setPrompt('')
  }

  const resume = async (e, id) => {
    e.preventDefault()
    if (!cont?.text.trim() || busy) return
    if (await act('POST', `/api/sessions/${id}/continue`, { prompt: cont.text })) setCont(null)
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
                    <span>{p.name}<small>{p.path}</small></span>
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
              <button type="submit" className="btn sm" disabled={busy || !pname.trim() || !ppath.trim()}>Tambah proyek</button>
            </form>
            <p className="note">
              Claude hanya boleh membaca dan mengedit file di folder ini, tanpa perintah shell. Hapus hanya mencabut dari daftar, foldernya tetap ada.
            </p>
          </details>
          {projects.length > 0 && (
            <form className="sform" onSubmit={start}>
              <select className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyek">
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
        </section>
      )}
    </>
  )
}
