import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import test from 'node:test'
import { startHttpServer } from '../../src/utils/httpServer.js'

/**
 * Phase 11 (D1, Coolify): Node's server.requestTimeout defaults to 300 s, which cuts off a
 * 100 MB recording on a connection under ~2.7 Mbps. REQUEST_TIMEOUT_MS (default 15 minutes) sets
 * it; headersTimeout and keepAliveTimeout stay at Node's defaults.
 */

const listening = (server) => new Promise((resolve) => {
  if (server.listening) resolve()
  else server.once('listening', resolve)
})
const close = (server) => new Promise((resolve) => server.close(() => resolve()))

test('D1: the server gets REQUEST_TIMEOUT_MS as requestTimeout; headersTimeout and keepAliveTimeout keep Node\'s defaults', async () => {
  const defaults = http.createServer()
  let reported
  const server = startHttpServer((req, res) => res.end('ok'), { port: 0, host: '127.0.0.1', requestTimeoutMs: 123_456 }, (address) => { reported = address })
  await listening(server)
  try {
    assert.equal(server.requestTimeout, 123_456)
    assert.equal(server.headersTimeout, defaults.headersTimeout)
    assert.equal(server.keepAliveTimeout, defaults.keepAliveTimeout)
    assert.equal(server.address().address, '127.0.0.1')
    assert.equal(reported.port, server.address().port)
  } finally {
    await close(server)
  }
})

// env.js reads the environment once per process, so each case runs in a child process.
const BASE = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1/signpakcommons',
  JWT_SECRET: 'request-timeout-test-secret-request-timeout-test',
  ADMIN_EMAIL: 'admin@signpak.test',
  ADMIN_PASSWORD: 'Admin@12345',
}

function resolvedTimeout(overrides) {
  try {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', 'const { env } = await import("./src/config/env.js"); console.log(env.REQUEST_TIMEOUT_MS)'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...BASE, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, value: Number(stdout.trim()) }
  } catch (error) {
    return { status: error.status ?? 1, stderr: String(error.stderr ?? '') }
  }
}

test('D1: REQUEST_TIMEOUT_MS defaults to 15 minutes, takes a value, and refuses 0, text and values under 60 s', () => {
  assert.deepEqual(resolvedTimeout({}), { status: 0, value: 900_000 })
  assert.deepEqual(resolvedTimeout({ REQUEST_TIMEOUT_MS: '1200000' }), { status: 0, value: 1_200_000 })
  for (const bad of ['0', 'fifteen', '59999', '-1']) {
    const result = resolvedTimeout({ REQUEST_TIMEOUT_MS: bad })
    assert.equal(result.status, 1, `REQUEST_TIMEOUT_MS=${bad} should be refused`)
    assert.match(result.stderr, /REQUEST_TIMEOUT_MS/)
  }
})
