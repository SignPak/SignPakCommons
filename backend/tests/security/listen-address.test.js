import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import url from 'node:url'

/**
 * SECURITY (S3): the real server.js, started in production, must only be reachable on loopback.
 *
 * With TRUST_PROXY=true the API believes X-Forwarded-For. If Node also listened on the public
 * interface, anyone could skip Nginx, connect to port 5000 directly and claim any IP, evading IP
 * restrictions and rate limits. So in production Node listens on 127.0.0.1 and only Nginx, on
 * the same machine, can reach it. Initialization is made to fail fast (unparseable database
 * URI); the listener starts before it, which is all this test needs.
 */

const backendRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..')
let child, port

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address()
    probe.close(() => resolve(free))
  })
})

const tryConnect = (host) => new Promise((resolve) => {
  const socket = net.connect({ host, port })
  socket.setTimeout(1000) // a firewalled address times out rather than refusing; both count as unreachable
  socket.once('connect', () => { socket.destroy(); resolve('connected') })
  socket.once('timeout', () => { socket.destroy(); resolve('timeout') })
  socket.once('error', (error) => resolve(error.code))
})

// The machine's own non-loopback IPv4 addresses: what a remote client would connect to.
const externalAddresses = () => Object.values(os.networkInterfaces()).flat()
  .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
  .map((entry) => entry.address)

before(async () => {
  port = await freePort()
  child = spawn(process.execPath, ['server.js'], {
    cwd: backendRoot,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      NODE_ENV: 'production',
      LOG_LEVEL: 'silent',
      PORT: String(port),
      TRUST_PROXY: 'true',
      MONGODB_URI: 'not-a-mongodb-uri',
      JWT_SECRET: 'listen-address-test-secret-listen-address-test',
      ADMIN_EMAIL: 'admin@signpak.test',
      ADMIN_PASSWORD: 'Admin@12345',
      BREVO_API_KEY: 'key',
      BREVO_SENDER_EMAIL: 'no-reply@signpak.tech',
      WEB3FORMS_ACCESS_KEY: 'key',
      EMAIL_HASH_SECRET: 'production-email-hash-secret-production-email-hash',
      CLIENT_ORIGIN: 'https://commons.signpak.tech',
      UPLOAD_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'signpak-listen-')),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })

  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server.js exited early (${child.exitCode}): ${stderr}`)
    if (await tryConnect('127.0.0.1') === 'connected') return
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`server.js never listened on 127.0.0.1:${port}: ${stderr}`)
})

after(() => { child?.kill() })

describe('security: where the production server listens', () => {
  test('S3: the production server answers on loopback, where Nginx connects', async () => {
    assert.equal(await tryConnect('127.0.0.1'), 'connected')
  })

  test('S3: the production server refuses connections on the machine\'s network addresses', async (t) => {
    const addresses = externalAddresses()
    if (addresses.length === 0) {
      t.diagnostic('this machine has no non-loopback IPv4 address; nothing to check here')
      return
    }
    for (const address of addresses) {
      const result = await tryConnect(address)
      assert.notEqual(result, 'connected', `port ${port} must not be reachable on ${address} (got ${result})`)
    }
  })
})
