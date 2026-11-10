import { useState, useEffect, useCallback } from 'react'

// Akses kontrol Claude Code: token, daftar proyek, dan daftar sesi. Hanya ada di komputer yang menjalankan server;
// dari jaringan server menjawab 403 dan `on` tetap false, jadi semua kontrolnya tidak tampil.
// tick naik tiap server memberi sinyal bahwa sesi berubah.
export function useControl(tick) {
  const [ctl, setCtl] = useState(null) // null: memuat, 'off': tidak tersedia, objek: { token }
  const [projects, setProjects] = useState([]) // { id, name, path, checks }
  const [sessions, setSessions] = useState(null) // null: belum dimuat
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/control')
      .then((r) => (r.ok ? r.json() : 'off'))
      .then(setCtl)
      .catch(() => setCtl('off'))
  }, [])

  const token = ctl && ctl !== 'off' ? ctl.token : null
  const call = useCallback((method, url, body) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Kantor-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  }), [token])

  useEffect(() => {
    if (!token) return
    call('GET', '/api/projects')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then(setProjects)
      .catch(() => setError('Daftar proyek tidak bisa dimuat.'))
  }, [token, call])

  const reload = useCallback(() => {
    if (!token) return
    call('GET', '/api/sessions')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ditolak'))))
      .then((l) => { setSessions(l); setError('') })
      .catch(() => setError('Server tidak menjawab atau menolak permintaan.'))
  }, [token, call])

  useEffect(() => { reload() }, [reload, tick])

  return { on: !!token, call, projects, setProjects, sessions, error, setError, reload }
}
