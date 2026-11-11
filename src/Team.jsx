import { useState } from 'react'

const MODEL = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable' }

// Peran tim: subagent di .claude/agents yang dibawa setiap sesi dari papan. Peran baru bisa diambil dari katalog
// aitmpl.com; isinya ditampilkan dulu karena teks itu nanti menjadi instruksi subagent.
export function Team({ call }) {
  const [kit, setKit] = useState(null) // null: belum dibuka
  const [ref, setRef] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    call('GET', '/api/kit')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then((k) => { setKit(k); setError('') })
      .catch(() => setError('Daftar peran tidak bisa dimuat.'))
  }

  const ask = async (url, hash) => {
    setBusy(true)
    try {
      const r = await call('POST', url, { ref: ref.trim(), hash })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'Permintaan gagal'); return null }
      setError('')
      return j
    } catch {
      setError('Server tidak terjangkau')
      return null
    } finally {
      setBusy(false)
    }
  }

  const look = async (e) => {
    e.preventDefault()
    if (!ref.trim() || busy) return
    setPreview(await ask('/api/kit/preview'))
  }

  const save = async () => {
    const list = await ask('/api/kit/import', preview.hash)
    if (!list) return
    setKit(list)
    setPreview(null)
    setRef('')
  }

  return (
    <details className="pmanage" onToggle={(e) => { if (e.currentTarget.open && !kit) load() }}>
      <summary>Peran tim{kit ? ` (${kit.length})` : ''}</summary>
      {kit === null && !error && <p className="empty">Memuat peran.</p>}
      {kit?.length === 0 && <p className="empty">Belum ada peran di .claude/agents. Ambil satu dari katalog di bawah.</p>}
      <ul className="plist">
        {kit?.map((k) => (
          <li key={k.name} className="prow">
            <span title={k.description}>
              {k.name}
              <small>{k.model ? MODEL[k.model] ?? k.model : 'ikut model sesi'}, {k.writes ? 'boleh mengubah file' : 'hanya membaca'}</small>
            </span>
          </li>
        ))}
      </ul>
      <form className="sform" onSubmit={look}>
        <label className="pcheck" htmlFor="peran-katalog">Ambil peran dari aitmpl.com (kategori/nama)</label>
        <input
          id="peran-katalog"
          className="field"
          value={ref}
          maxLength={110}
          disabled={busy}
          onChange={(e) => { setRef(e.target.value); setPreview(null) }}
          placeholder="development-team/frontend-developer"
        />
        <button type="submit" className="btn sm" disabled={busy || !ref.trim()}>Lihat isinya</button>
      </form>
      {preview && (
        <div className="sess panel">
          <div className="shead"><b>{preview.name}</b></div>
          <div className="sact">{preview.description}</div>
          <div className="note">Tool yang diminta: {preview.tools.length ? preview.tools.join(', ') : 'semua tool sesi'}. Izin proyek tetap membatasinya. Yang disimpan hanya nama, deskripsi, tool, model, dan instruksi di bawah.</div>
          <details open>
            <summary>Instruksi peran</summary>
            <pre tabIndex={0}>{preview.prompt}</pre>
          </details>
          {preview.exists
            ? <div className="note bad">Peran bernama {preview.name} sudah ada di kit dan tidak akan ditimpa.</div>
            : <div className="sbtns"><button className="btn sm go" disabled={busy} onClick={save}>Simpan ke kit</button></div>}
        </div>
      )}
      {error && <div role="alert" className="note bad">{error}</div>}
      <p className="note">
        Nama peran ada di <a href="https://www.aitmpl.com/agents" target="_blank" rel="noreferrer">katalog aitmpl.com</a>. Peran tersimpan sebagai berkas di .claude/agents dan ikut ke proyek baru.
      </p>
    </details>
  )
}
