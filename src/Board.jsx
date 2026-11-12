import { useState, useEffect, useRef } from 'react'
import { sfx } from './sfx'
import { lookFor } from './looks'
import { Epics, EpicFields } from './Epics'
import { Sec } from './Sec'
import { tok } from './fmt'
import { Sessions } from './Sessions'

const clock = (at) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
// jendela jatah langganan yang dilaporkan Claude Code, sama dengan halaman Usage di pengaturan akun
const WINDOWS = [['fiveHour', 'Sesi 5 jam'], ['sevenDay', 'Mingguan, semua model']]
const resetAt = (at) => (new Date(at).toDateString() === new Date().toDateString() ? clock(at) : `${new Date(at).toLocaleDateString([], { weekday: 'short' })} ${clock(at)}`)
const STATE = { working: 'kerja', walking: 'jalan', idle: 'senggang' }
const CLAUDE = 'Claude Code'
const whoLabel = (who) => (who === 'claude' ? CLAUDE : who ? lookFor(who).label : null)

// Hasil task simulasi berbentuk satu judul lalu baris "kunci: isi": ditata sebagai judul dan daftar. Teks lain
// (hasil sesi Claude, catatan pekerjaan besar) tampil apa adanya, dan keduanya punya batas tinggi dengan gulir sendiri.
function Result({ text, plain }) {
  const [head, ...rest] = text.split('\n')
  const rows = rest.filter(Boolean)
  if (plain || !rows.length || rows.length > 6 || text.length > 400) return <pre tabIndex={0} aria-label="Hasil">{text}</pre>
  return (
    <div className="result" tabIndex={0} aria-label="Hasil">
      <p className="verdict">{head}</p>
      <dl>
        {rows.map((r, i) => {
          const m = /^([^:]{1,24}): (.+)$/.exec(r)
          return m
            ? <div key={i}><dt>{m[1][0].toUpperCase() + m[1].slice(1)}</dt><dd>{m[2]}</dd></div>
            : <div key={i}><dd className="wide">{r}</dd></div>
        })}
      </dl>
    </div>
  )
}

// Panel pantauan: angka ringkas, tim, dan log kejadian. Token, sisa jatah, dan jumlah sesi hanya untuk pemilik komputer.
function Watch({ tasks, agents, agentsStatic, events, control }) {
  const [stats, setStats] = useState(null) // jumlah task selesai per agent; null = memuat
  const [failed, setFailed] = useState(false)
  const [cost, setCost] = useState(null) // { tokens_today, tokens_machine, runs, limits }
  const [refreshing, setRefreshing] = useState(false)
  const { on, call } = control
  const refresh = () => {
    setRefreshing(true)
    call('POST', '/api/usage/refresh').then((r) => (r.ok ? r.json() : null)).then((d) => d && setCost(d)).catch(() => {}).finally(() => setRefreshing(false))
  }
  useEffect(() => {
    if (!on) return
    const load = () => call('GET', '/api/costs').then((r) => (r.ok ? r.json() : null)).then(setCost).catch(() => {})
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [on, call])
  // jumlah selesai hanya berubah bersama daftar task, jadi dimuat ulang saat daftar itu berganti, bukan tiap beberapa detik
  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then((d) => { setStats(d); setFailed(false) }).catch(() => setFailed(true))
  }, [tasks])

  const done = tasks.filter((t) => t.status === 'done').length
  const busy = tasks.filter((t) => t.status === 'in_progress').length
  const running = on ? (control.sessions ?? []).filter((s) => s.state === 'running' || s.state === 'stopping').length : null
  const team = agentsStatic.map((s) => {
    const run = agents.find((a) => a.id === s.id)
    const task = tasks.find((t) => t.agent_id === s.id && t.status === 'in_progress')
    return { id: s.id, look: lookFor(s.id), state: run?.state ?? 'idle', now: task ? task.title : run?.bubble, done: stats?.find((x) => x.id === s.id)?.done }
  })
  const working = team.filter((x) => x.state === 'working').length

  return (
    <>
      <Sec id="ringkasan" label="Ringkasan" title="Ringkasan">
        <div className="tiles">
          <div className="tile"><b>{done}</b><span>selesai</span></div>
          <div className="tile"><b>{busy}</b><span>dikerjakan</span></div>
          {running !== null && <div className="tile"><b>{running}</b><span>sesi Claude</span></div>}
        </div>
      </Sec>
      {on && cost && (
        <Sec id="usage" label="Usage Claude" title="Usage Claude" count={cost.limits?.fiveHour ? `${Math.round(cost.limits.fiveHour.used * 100)}%` : null}>
          {WINDOWS.map(([k, label]) => {
            // server membuang jendela yang waktu resetnya sudah lewat
            const w = cost.limits?.[k]
            return w && (
              <div key={k} className="ugauge">
                <div className="urow"><span>{label}<small>reset {resetAt(w.resetsAt)}</small></span><b>{Math.round(w.used * 100)}% terpakai</b></div>
                <div className="bar"><i style={{ transform: `scaleX(${w.used})` }} /></div>
              </div>
            )
          })}
          {!cost.limits?.fiveHour && !cost.limits?.sevenDay && <p className="empty">Jatah belum terbaca. Tekan Perbarui bila tidak muncul sendiri.</p>}
          <div className="urow"><span>Token aplikasi ini hari ini</span><b>{tok(cost.tokens_today)}</b></div>
          <div className="urow"><span>Token Claude Code di komputer ini hari ini</span><b>{cost.tokens_machine == null ? 'menghitung' : tok(cost.tokens_machine)}</b></div>
          <p className="note">
            Persen jatah berlaku untuk seluruh akunmu, termasuk claude.ai. Token hanya dari Claude Code (bukan claude.ai), tanpa bacaan cache.
            {cost.limits?.at ? ` Jatah dibaca ${clock(cost.limits.at)}.` : ''}
          </p>
          <button type="button" className="btn sm ubtn" disabled={refreshing} onClick={refresh}>{refreshing ? 'Membaca jatah' : 'Perbarui jatah'}</button>
        </Sec>
      )}
      <Sec id="aktivitas" label="Aktivitas" title="Aktivitas" count={events.length} defaultOpen={false}>
        {events.length === 0 && <p className="empty">Belum ada kejadian. Tambah task di panel kiri.</p>}
        <ul className="alist">
          {[...events].reverse().map((e) => {
            const who = whoLabel(e.who)
            return (
              <li key={e.id ?? e.at}>
                <time dateTime={new Date(e.at).toISOString()}>{clock(e.at)}</time>
                {who && <b>{who} </b>}{e.text}
              </li>
            )
          })}
        </ul>
      </Sec>
      <Sec id="tim" label="Tim" title="Tim" count={`${working}/${team.length} kerja`}>
        {failed && <p className="empty">Jumlah task selesai tidak termuat.</p>}
        {team.map((x) => (
          <div key={x.id} className="trow" style={{ '--tag': x.look.tag }}>
            <i aria-hidden="true" />
            <div>
              <b>{x.look.label}</b>
              <small>{STATE[x.state] ?? x.state}{x.now ? `, ${x.now}` : ''}</small>
            </div>
            {x.done > 0 && <span aria-label={`${x.done} task selesai`}>{x.done}</span>}
          </div>
        ))}
      </Sec>
    </>
  )
}

const SECTION = {
  in_progress: 'Sedang dikerjakan',
  todo: 'Antrian',
  done: 'Selesai',
}

// Dua panel samping. Kiri: pekerjaan (sedang dikerjakan, antrian, selesai, form). Kanan: review yang
// butuh keputusan, lalu pantauan. Task Claude Code tampil untuk semua pemain (judul dan status), tetapi
// proyek, kemajuan sesi, hasil, dan tombol keputusan hanya muncul di komputer pemilik (control.on).
// hidden: panel tidak digambar, tetapi komponen tetap hidup supaya hitungan di judul tab dan bunyinya jalan terus.
export function Board({ tasks, agents, agentsStatic, events, onDelete, control, hidden = false, form = null, tick = 0 }) {
  const [open, setOpen] = useState(null)
  const [revise, setRevise] = useState(null) // { id, text }
  const [cardError, setCardError] = useState(null) // { id, text }
  const [busy, setBusy] = useState(false)
  const [diffs, setDiffs] = useState({}) // perubahan per task atau pekerjaan yang dibuka: { error } atau { files, patch }; dikosongkan saat dialog ditutup
  const [epicPending, setEpicPending] = useState(0) // pekerjaan besar yang menunggu keputusan pemilik
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
  // pekerjaan besar dan task punya nomor sendiri-sendiri, jadi kuncinya diberi awalan
  const openId = open ? `${open.epic ? 'epics' : 'tasks'}/${open.id}` : null
  const diff = wantsDiff ? (diffs[openId] ?? 'loading') : null
  useEffect(() => {
    if (!wantsDiff) return undefined
    let stale = false
    ownerCall('GET', `/api/${openId}/diff`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!stale) setDiffs((d) => ({ ...d, [openId]: r.ok ? j : { error: j.error ?? 'Perubahan tidak bisa dimuat' } })) })
      .catch(() => { if (!stale) setDiffs((d) => ({ ...d, [openId]: { error: 'Server tidak terjangkau' } })) })
    return () => { stale = true }
  }, [wantsDiff, openId, ownerCall])

  // jumlah task Claude yang menunggu keputusanmu tampil di judul tab; bunyi saat bertambah (bukan saat halaman dibuka)
  const pending = control.on ? tasks.filter((t) => t.mode === 'claude' && t.status === 'review').length + epicPending : 0
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

  const card = (t) => {
    const claude = t.mode === 'claude'
    const mine = claude && control.on
    const session = mine && t.status === 'in_progress' ? control.sessions?.find((s) => s.id === t.session_id) : null
    const subagents = (session?.subagents ?? []).filter((x) => x.state === 'running').map((x) => x.type)
    const canOpen = t.status === 'done'
    // task pekerjaan besar dibuang lewat pekerjaannya, karena task lain menunggunya
    const canDelete = !t.epic_id && (t.status === 'todo' || t.status === 'done' || (mine && t.status === 'review'))
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
          {t.agent_id && <div className="who">{lookFor(t.agent_id).label}</div>}
          {claude && <div className="who">{CLAUDE}{mine && t.project_id ? `, ${projectName(t.project_id)}` : ''}{mine && t.tokens > 0 ? `, ${tok(t.tokens)} token` : ''}</div>}
          {claude && t.status === 'in_progress' && (
            <div className="tlive">
              {mine && t.checks === 'jalan'
                ? 'Server menjalankan tes dan build'
                : session
                  ? `${session.activity}${session.tools ? `, ${session.tools} tool` : ''}${subagents.length ? `. Subagent: ${subagents.join(', ')}` : ''}`
                  : 'Sedang dikerjakan'}
              {mine && t.attempts > 0 ? `. Perbaikan otomatis ke-${t.attempts}` : ''}
            </div>
          )}
          {!claude && t.status === 'review' && <div className="tnote">Menunggu review Tech Lead</div>}
          {claude && t.status === 'review' && t.output && <div className="tnote">{t.output}</div>}
          {mine && t.branch && t.status === 'review' && <div className="tnote">Cabang {t.branch}</div>}
          {mine && t.status === 'review' && (
            <div className="tact">
              {!t.epic_id && <button className="btn sm go" disabled={busy} onClick={() => decide(t.id, 'approve')}>Setujui</button>}
              {t.session_id && (
                <button className="btn sm" aria-expanded={revise?.id === t.id} onClick={() => setRevise(revise?.id === t.id ? null : { id: t.id, text: '' })}>
                  Revisi
                </button>
              )}
              <button className="btn sm" disabled={busy} onClick={() => decide(t.id, 'retry')}>Ulangi</button>
              {(t.detail || t.branch) && <button className="btn sm" aria-label={`Lihat detail: ${t.title}`} onClick={() => setOpen(t)}>Detail</button>}
              {t.branch && (
                <button className="btn sm go full" disabled={busy} title={t.epic_id ? 'Gabungkan cabang task ke cabang pekerjaan besarnya' : 'Gabungkan cabang task ke cabang aktif proyek'} onClick={() => decide(t.id, 'merge')}>
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
  }

  const byStatus = (s) => tasks.filter((t) => t.status === s)
  const section = (key, empty) => {
    const items = byStatus(key)
    return (
      <Sec id={key} className={key} label={SECTION[key]} title={SECTION[key]} count={items.length} defaultOpen={key !== 'done'}>
        {items.length === 0 && <p className="empty">{empty}</p>}
        {items.map(card)}
      </Sec>
    )
  }
  const review = byStatus('review')
  // Daftar pekerjaan besar dimuat ulang tiap server memberi sinyal task atau sesi berubah. Saat panel disembunyikan
  // komponennya tetap hidup (tanpa tampilan) supaya hitungan di judul tab dan bunyinya jalan terus.
  const epics = (
    <Epics
      key="epics"
      control={control}
      hidden={hidden}
      reloadKey={`${tick}|${(control.sessions ?? []).map((s) => s.state).join()}`}
      onOpen={(e) => setOpen({ ...e, epic: true, mode: 'claude', output: e.note })}
      onPending={setEpicPending}
    />
  )

  return (
    <>
      {hidden && epics}
      {!hidden && (
        <>
          <aside className="side left" aria-label="Pekerjaan">
            {epics}
            {section('in_progress', 'Tidak ada yang dikerjakan. Antrian kosong atau semua agent sibuk.')}
            {section('todo', 'Antrian kosong. Tambah task di bawah.')}
            {section('done', 'Belum ada task selesai.')}
            <Sec id="form" label="Task baru" title="Task baru" keep>{form}</Sec>
            <Sessions control={control} />
          </aside>
          <aside className="side right" aria-label="Pantauan">
            <Sec id="review" className="review" label="Review" title={owner ? 'Butuh keputusanmu' : 'Review'} count={review.length}>
              {review.length === 0 && <p className="empty">{owner ? 'Tidak ada yang menunggu keputusan.' : 'Tidak ada yang menunggu review.'}</p>}
              {review.map(card)}
            </Sec>
            <Watch tasks={tasks} agents={agents} agentsStatic={agentsStatic} events={events} control={control} />
          </aside>
        </>
      )}

      {open && (
        <div className="backdrop" onClick={closeDialog}>
          <div className="dialog panel" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()}>
            <h2>{open.title}</h2>
            <div className="meta">
              {open.epic ? 'Pekerjaan besar' : open.mode === 'claude' ? CLAUDE : lookFor(open.agent_id).label} {open.finished_at
                ? `selesai pukul ${clock(open.finished_at)}`
                : open.status === 'review' ? 'menunggu keputusan' : 'belum tercatat'}{open.branch ? ` di cabang ${open.branch}` : ''}
            </div>
            <Result text={(open.mode === 'claude' && open.detail) || open.output || '(tidak ada output)'} plain={open.mode === 'claude' || open.epic} />
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
  const [who, setWho] = useState('sim') // 'sim' | 'claude' | 'epic' (pekerjaan besar untuk tim)
  const [epic, setEpic] = useState({ projectId: '', prompt: '', budget: 10, auto: true })
  const [projectId, setProjectId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [kit, setKit] = useState(null) // peran (subagent kit); null: belum dimuat
  const [picked, setPicked] = useState(null) // null: semua peran; selain itu daftar nama yang dipilih

  const canClaude = control.on && control.projects.length > 0
  const claude = who === 'claude' && canClaude
  const team = who === 'epic' && canClaude
  const chosen = control.projects.some((p) => p.id === projectId) ? projectId : (control.projects[0]?.id ?? '')
  const epicProject = control.projects.some((p) => p.id === epic.projectId) ? epic.projectId : (control.projects[0]?.id ?? '')

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

  const addEpic = async () => {
    try {
      const r = await control.call('POST', '/api/epics', { title: title.trim(), projectId: epicProject, prompt: epic.prompt, budget: Number(epic.budget), auto: epic.auto })
      if (r.ok) return { ok: true }
      const body = await r.json().catch(() => ({}))
      return { ok: false, error: body.error ?? 'pekerjaan gagal ditambahkan' }
    } catch {
      return { ok: false, error: 'server tidak terjangkau' }
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    const res = team ? await addEpic() : claude ? await addClaude() : await onAdd(title.trim(), est)
    setBusy(false)
    // gagal: judul tetap di kolom supaya tidak perlu diketik ulang
    if (res?.ok === false) return setError(res.error)
    setError('')
    setTitle('')
    setPrompt('')
    setPicked(null)
    setEpic((v) => ({ ...v, prompt: '' }))
  }

  return (
    <form onSubmit={submit} className="taskform">
      {error && <div role="alert" className="err panel">Task tidak masuk: {error}</div>}
      <input
        className="field title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={team ? 'Nama pekerjaan, mis: aplikasi kasir' : 'Task baru, mis: fix bug login'}
        aria-label="Judul task baru"
        maxLength={80}
      />
      {control.on && (
        <select className="field" value={team ? 'epic' : claude ? 'claude' : 'sim'} onChange={(e) => setWho(e.target.value)} aria-label="Dikerjakan oleh">
          <option value="sim">Agent simulasi</option>
          <option value="claude" disabled={!canClaude}>{canClaude ? `${CLAUDE}, satu task` : `${CLAUDE} (tambah proyek dulu)`}</option>
          <option value="epic" disabled={!canClaude}>{canClaude ? 'Tim Claude, pekerjaan besar' : 'Tim Claude (tambah proyek dulu)'}</option>
        </select>
      )}
      {team ? (
        <EpicFields projects={control.projects} value={{ ...epic, projectId: epicProject }} onChange={setEpic} />
      ) : claude ? (
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
      <button type="submit" className="btn go" disabled={busy || (team && !epic.prompt.trim())}>{team ? 'Serahkan ke tim' : 'Tambah task'}</button>
    </form>
  )
}
