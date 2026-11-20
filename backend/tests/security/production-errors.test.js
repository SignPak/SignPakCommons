import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import url from 'node:url'

/**
 * SECURITY: what a production server tells a client when it is broken.
 *
 * The app runs as a separate production process whose initialization fails (an unparseable
 * MONGODB_URI carrying a fake password). Every response must stay generic: no `detail`, no
 * stack, no echo of the configuration, no framework fingerprint (FIX-PLAN 4.5, checklist S5).
 */

const here = path.dirname(url.fileURLToPath(import.meta.url))
const SECRET = 'hunter2-not-real'
let child, origin

before(async () => {
  child = spawn(process.execPath, [path.join(here, '..', 'support', 'productionApp.js')], {
    cwd: path.resolve(here, '..', '..'),
    // The child sets its own production environment; start from a clean one.
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

const get = async (pathname, headers = {}) => {
  const response = await fetch(origin + pathname, { headers })
  const text = await response.text()
  return { status: response.status, headers: response.headers, text, body: JSON.parse(text) }
}

const assertGeneric = (response) => {
  assert.ok(!('detail' in (response.body.error ?? {})), `no detail field: ${response.text}`)
  assert.ok(!('stack' in (response.body.error ?? {})), `no stack field: ${response.text}`)
  assert.ok(!response.text.includes(SECRET), 'the database password must not be echoed')
  assert.ok(!/postgres:\/\/|db\.internal|MongoParseError|at .+\.js:\d+/i.test(response.text), `no config or stack text: ${response.text}`)
  assert.equal(response.headers.get('x-powered-by'), null)
}

describe('security: production error responses', () => {
  test('S5: the production 503 has no detail and does not echo the error', async () => {
    const response = await get('/api/v1/categories')
    assert.equal(response.status, 503)
    assert.deepEqual(response.body, {
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Service initializing or misconfigured.' },
    })
    assertGeneric(response)
  })

  test('S5: every route answers with the same generic body while initialization fails', async () => {
    for (const pathname of ['/api/v1/auth/session', '/api/v1/videos', '/api/v1/admin/users', '/api/v1/no-such-route']) {
      const response = await get(pathname, { origin: 'https://commons.example.test' })
      assert.equal(response.status, 503, pathname)
      assertGeneric(response)
    }
  })

  test('C1: the production health check reports the failure as booleans only', async () => {
    const response = await get('/api/v1/health')
    assert.equal(response.status, 503)
    assert.equal(response.body.data.status, 'degraded')
    assert.equal(response.body.data.database, 'disconnected')
    assert.equal(response.body.data.storage, false)
    assertGeneric(response)
  })
})
