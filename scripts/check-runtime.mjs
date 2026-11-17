// Проверка именно собранного образа. Используются только новые тестовые контейнеры и том.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'

const image = process.argv[2] ?? 'faza:runtime-check'
const id = `faza-check-${randomUUID()}`, volume = `${id}-data`
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 }).trim()
const socket = createServer()
await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve) })
const port = socket.address().port
await new Promise((resolve, reject) => socket.close((err) => err ? reject(err) : resolve()))
const base = `http://127.0.0.1:${port}`
let created = false, volumeCreated = false
async function start() {
  docker('run', '-d', '--name', id, '-p', `127.0.0.1:${port}:8787`, '-v', `${volume}:/data`, '-e', `FAZA_BASE_URL=${base}`, image)
  created = true
  const end = Date.now() + 20000
  while (Date.now() < end) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })
      if (r.ok && (await r.json()).ok) return
    } catch { /* процесс ещё запускается */ }
    await setTimeout(200)
  }
  throw new Error('Контейнер не готов за 20 секунд')
}
class Client {
  cookies = new Map()
  async request(method, path, data) {
    const res = await fetch(base + path, {
      method, signal: AbortSignal.timeout(5000),
      headers: { origin: base, 'content-type': 'application/json', cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(';')[0], at = pair.indexOf('='), key = pair.slice(0, at), value = pair.slice(at + 1)
      if (value) this.cookies.set(key, value); else this.cookies.delete(key)
    }
    return { status: res.status, data: await res.json() }
  }
}
try {
  docker('volume', 'create', volume); volumeCreated = true
  await start()
  const forbidden = JSON.parse(docker('exec', id, 'node', '--input-type=module', '-e', `
    import fs from 'node:fs'; import path from 'node:path';
    const blocked = new Set(['picomatch','vite','vitest','tsx','esbuild']);
    console.log(JSON.stringify(fs.readdirSync('node_modules', {recursive:true, withFileTypes:true})
      .filter(e => e.isDirectory() && blocked.has(e.name) && path.basename(e.parentPath) === 'node_modules')
      .map(e => path.join(e.parentPath,e.name))));
  `))
  assert.deepEqual(forbidden, [], 'В рабочем образе остались инструменты сборки или picomatch')
  const html = await fetch(base).then((r) => r.text())
  const asset = html.match(/src="([^\"]+\.js)"/)?.[1]
  assert.ok(asset, 'Не найден собранный интерфейс')
  assert.equal((await fetch(new URL(asset, base))).status, 200)
  const A = new Client(), B = new Client()
  assert.equal((await A.request('GET', '/api/me')).status, 401)
  const email = `runtime-${randomUUID()}@example.test`, password = 'runtime-test-password-123'
  assert.equal((await A.request('POST', '/api/auth/sign-up/email', { name: 'Runtime A', email, password })).status, 200)
  const attempt = { id: randomUUID(), labId: 'solutions-sheet', at: Date.now(), summary: 'Проверка рабочего образа' }
  const changedAt = Date.now()
  const diagnostic = { track: 'starter', changedAt, answers: { 's-ph': { result: 'ok', at: changedAt } } }
  const saved = await A.request('PUT', '/api/me/state', { baseRev: 0, data: { visited: { 'solutions-basics': 123 }, attempts: [attempt], diag: diagnostic } })
  assert.equal(saved.status, 200); assert.equal(saved.data.rev, 1)
  const stale = await A.request('PUT', '/api/me/state', { baseRev: saved.data.rev, data: { diag: { answers: { 'd-rheo': { result: 'ok', at: changedAt + 1000 } }, finishedAt: changedAt + 1001 } } })
  assert.equal(stale.status, 200); assert.equal(stale.data.data.diag.track, 'starter')
  assert.equal(stale.data.merged, true)
  assert.deepEqual(stale.data.data.diag.answers, diagnostic.answers)
  assert.equal(stale.data.data.diag.finishedAt, undefined)
  assert.equal((await B.request('POST', '/api/auth/sign-up/email', { name: 'Runtime B', email: `other-${email}`, password })).status, 200)
  assert.equal((await B.request('GET', `/api/attempts/${attempt.id}`)).status, 404)
  const search = await A.request('GET', '/api/search/catalog?q=эмульсия')
  assert.equal(search.status, 200); assert.ok(search.data.results.length > 0)
  // Новый контейнер на том же томе: сохраняются база, секрет сессий, аккаунт и прогресс.
  docker('rm', '-f', id); created = false
  await start()
  const restored = await A.request('GET', '/api/me')
  assert.equal(restored.status, 200); assert.equal(restored.data.user.email, email)
  assert.equal(restored.data.data.visited['solutions-basics'], 123)
  assert.equal(restored.data.data.diag.track, 'starter')
  assert.deepEqual(restored.data.data.diag.answers, diagnostic.answers)
  assert.equal((await A.request('GET', `/api/attempts/${attempt.id}`)).data.summary, attempt.summary)
  assert.equal((await A.request('POST', '/api/auth/sign-out', {})).status, 200)
  assert.equal((await A.request('GET', '/api/me')).status, 401)
  assert.equal((await A.request('POST', '/api/auth/sign-in/email', { email, password })).status, 200)
  assert.equal((await A.request('GET', '/api/me')).data.data.attempts.length, 1)
  console.log('Рабочий образ: интерфейс, API, авторизация, изоляция пользователей и сохранность тома — проверены; picomatch и инструменты сборки отсутствуют.')
} catch (err) {
  if (created) { try { console.error(docker('logs', '--tail', '25', id)) } catch { /* исходная ошибка важнее */ } }
  throw err
} finally {
  if (created) docker('rm', '-f', id)
  if (volumeCreated) docker('volume', 'rm', volume)
}
