// Pemeriksaan oleh server: setelah sesi Claude selesai, server sendiri menjalankan tes dan build di folder
// kerja task. Hasilnya tidak bergantung pada laporan model. Hanya dijalankan untuk proyek yang dicentang
// "tes dan build", karena skrip di package.json adalah kode yang ikut ditulis sesi.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TAIL = 3000
const SCRIPTS = [['test', 'npm test'], ['build', 'npm run build']]

// Perintahnya teks tetap dari daftar di atas, bukan dari task. Di Windows npm adalah berkas .cmd, jadi lewat cmd.exe.
function defaultRun(cmd, cwd, timeout) {
  const [file, args] = process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', cmd]] : ['sh', ['-c', cmd]]
  return new Promise((resolve) => {
    execFile(file, args, { cwd, timeout, maxBuffer: 32 * 1024 * 1024, windowsHide: true, env: { ...process.env, CI: '1' } }, (err, stdout, stderr) => {
      resolve({ ok: !err, output: `${stdout}\n${stderr}`.trim(), timedOut: err?.killed === true })
    })
  })
}

// Skrip yang ada di package.json folder itu (skrip tes bawaan `npm init` yang selalu gagal dilewati).
export function checksFor(cwd) {
  let scripts
  try { scripts = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).scripts ?? {} } catch { return [] }
  return SCRIPTS.filter(([name]) => typeof scripts[name] === 'string' && !/no test specified/.test(scripts[name])).map(([, cmd]) => cmd)
}

// { ran: [perintah], ok, failed, output }. Berhenti di perintah pertama yang gagal. ran kosong: tidak ada yang diperiksa.
// install: proyek yang boleh memasang paket bekerja tanpa junction node_modules, jadi dependensinya dipasang
// dulu di folder kerja itu (`npm install` mengikuti package.json hasil kerja task).
export async function runChecks(cwd, { run = defaultRun, timeout = 10 * 60 * 1000, install = false } = {}) {
  const ran = []
  const checks = checksFor(cwd)
  for (const cmd of checks.length && install ? ['npm install', ...checks] : checks) {
    ran.push(cmd)
    const r = await run(cmd, cwd, timeout)
    if (!r.ok) return { ran, ok: false, failed: cmd, output: `${r.timedOut ? '(melebihi batas waktu)\n' : ''}${r.output.slice(-TAIL)}` }
  }
  return { ran, ok: true }
}
