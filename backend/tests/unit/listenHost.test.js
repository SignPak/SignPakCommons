import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

/**
 * S3: which address the API listens on. Behind Nginx with TRUST_PROXY=true, anyone who could
 * reach Node directly could send their own X-Forwarded-For and pick the IP that rate limits
 * and IP restrictions see. So production listens on loopback only, where only Nginx can
 * connect; development keeps 0.0.0.0 so phones on the LAN can test against a laptop.
 * env.js reads the environment once per process, so each case runs in a child process.
 */

const BASE = {
  MONGODB_URI: 'mongodb://127.0.0.1/signpakcommons',
  JWT_SECRET: 'listen-host-test-secret-listen-host-test-secret',
  ADMIN_EMAIL: 'admin@signpak.test',
  ADMIN_PASSWORD: 'Admin@12345',
}
const PRODUCTION = {
  ...BASE,
  NODE_ENV: 'production',
  BREVO_API_KEY: 'key',
  BREVO_SENDER_EMAIL: 'no-reply@signpak.tech',
  WEB3FORMS_ACCESS_KEY: 'key',
}

function resolvedHost(overrides) {
  try {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', 'const { env } = await import("./src/config/env.js"); console.log(env.HOST)'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, host: stdout.trim() }
  } catch (error) {
    return { status: error.status ?? 1, stderr: String(error.stderr ?? '') }
  }
}

test('S3: production listens on 127.0.0.1 by default, so only Nginx can reach Node', () => {
  assert.deepEqual(resolvedHost(PRODUCTION), { status: 0, host: '127.0.0.1' })
})

test('S3: development and test listen on 0.0.0.0 by default', () => {
  assert.deepEqual(resolvedHost({ ...BASE, NODE_ENV: 'development' }), { status: 0, host: '0.0.0.0' })
  assert.deepEqual(resolvedHost({ ...BASE, NODE_ENV: 'test' }), { status: 0, host: '0.0.0.0' })
})

test('S3: an explicit HOST wins in every environment', () => {
  assert.deepEqual(resolvedHost({ ...PRODUCTION, HOST: '::1' }), { status: 0, host: '::1' })
  assert.deepEqual(resolvedHost({ ...BASE, NODE_ENV: 'development', HOST: '127.0.0.1' }), { status: 0, host: '127.0.0.1' })
})

test('S3: a blank HOST is rejected instead of silently meaning "all interfaces"', () => {
  const result = resolvedHost({ ...PRODUCTION, HOST: '   ' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /HOST/)
})
