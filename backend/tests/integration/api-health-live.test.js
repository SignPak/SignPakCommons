import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import url from 'node:url'
import { Client } from '../support/helpers.js' // test environment before env.js loads
import { createFakeDriveDriver } from '../support/fakeDriveDriver.js'

/**
 * Phase 11 (D1, Coolify): GET /api/v1/health/live is the container's health check. Traefik stops
 * routing to an unhealthy container, so it fails only when MongoDB is down. A storage failure
 * at startup (typically an expired Google Drive token, D3) is reported (storage: false, and
 * /health answers 503) but the API stays up: login and browsing keep working, only uploads and
 * playback from Drive fail. The health checks retry storage, so it recovers on its own.
 */

const here = path.dirname(url.fileURLToPath(import.meta.url))

describe('health/live with the database down', () => {
  let child, origin

  before(async () => {
    // The real app in production mode with a database URI that cannot be parsed.
    child = spawn(process.execPath, [path.join(here, '..', 'support', 'productionApp.js')], {
      cwd: path.resolve(here, '..', '..'),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`production app did not start: ${stderr}`)), 20_000)
      child.stdout.on('data', (chunk) => {
        const match = /LISTENING (\d+)/.exec(String(chunk))
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`) }
      })
      child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`production app exited ${code}: ${stderr}`)) })
    })
  })

  after(() => { child?.kill() })

  test('D1: /health/live answers 503 when the database is down', async () => {
    const response = await fetch(`${origin}/api/v1/health/live`)
    assert.equal(response.status, 503)
    const { data } = await response.json()
    assert.deepEqual(Object.keys(data).sort(), ['database', 'status', 'storage', 'uptime'])
    assert.equal(data.status, 'degraded')
    assert.equal(data.database, 'disconnected')
  })
})

describe('health/live with storage failing', () => {
  let memory, server, base, disconnectDb, restoreStorage, setStorageRetryIntervalForTests
  let driveFails = true
  // An in-memory Drive whose startup check fails the way an expired refresh token does.
  const drive = createFakeDriveDriver({ name: 'gdrive' })
  drive.init = async () => {
    if (driveFails) throw Object.assign(new Error('invalid_grant'), { response: { status: 400, data: { error: 'invalid_grant' } } })
  }

  before(async () => {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memory = await MongoMemoryServer.create()
    const [{ default: app }, db, storage, initialization] = await Promise.all([
      import('../../src/app.js'),
      import('../../src/config/db.js'),
      import('../../src/services/storage/index.js'),
      import('../../src/services/initialization.js'),
    ])
    ;({ disconnectDb } = db)
    ;({ setStorageRetryIntervalForTests } = initialization)
    restoreStorage = storage.routeStorageForTests({ primary: drive })
    await db.connectDb(memory.getUri('signpak_health_live'))
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}/api/v1`
  })

  after(async () => {
    restoreStorage?.()
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()))
    await disconnectDb?.()
    await memory?.stop()
  })

  test('D1: with storage failing, /health/live answers 200 with storage false while /health answers 503', async () => {
    const live = await new Client(base).get('/health/live')
    assert.equal(live.status, 200, JSON.stringify(live.body))
    assert.deepEqual({ ...live.body.data, uptime: 0 }, { status: 'degraded', database: 'connected', storage: false, uptime: 0 })

    const health = await new Client(base).get('/health')
    assert.equal(health.status, 503)
    assert.equal(health.body.data.status, 'degraded')
    assert.equal(health.body.data.database, 'connected')
    assert.equal(health.body.data.storage, false)
  })

  test('D1: with storage failing, login and browsing still work', async () => {
    const admin = new Client(base)
    const login = await admin.post('/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    assert.equal(login.status, 200, JSON.stringify(login.body))
    assert.equal((await admin.get('/auth/session')).body.data.email, process.env.ADMIN_EMAIL)
    const categories = await new Client(base).get('/categories')
    assert.equal(categories.status, 200, JSON.stringify(categories.body))
  })

  test('D1: the health checks retry storage, and /health is ok once it works again', async () => {
    driveFails = false
    setStorageRetryIntervalForTests(0)
    const health = await new Client(base).get('/health')
    assert.equal(health.status, 200, JSON.stringify(health.body))
    assert.equal(health.body.data.status, 'ok')
    assert.equal(health.body.data.storage, true)
    const live = await new Client(base).get('/health/live')
    assert.equal(live.body.data.status, 'ok')
  })
})
