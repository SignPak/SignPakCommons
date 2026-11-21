import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

/**
 * env.js calls process.exit(1) on a bad configuration, so each case runs in its own child
 * process. The point is that the two test-only switches cannot be turned on in production:
 * the server refuses to boot instead of quietly exposing the hook or swallowing email.
 */

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://127.0.0.1/signpakcommons',
  JWT_SECRET: 'production-secret-production-secret-123456',
  ADMIN_EMAIL: 'admin@signpak.test',
  ADMIN_PASSWORD: 'Admin@12345',
  BREVO_API_KEY: 'brevo-key',
  BREVO_SENDER_EMAIL: 'auth@signpak.test',
  WEB3FORMS_ACCESS_KEY: 'web3forms-key',
  EMAIL_HASH_SECRET: 'production-email-hash-secret-production-email-hash',
  TRUST_PROXY: 'true',
  COOKIE_SECURE: 'true',
}

/** Loads env.js in a child process; returns { status, stdout, stderr }. */
function loadEnv(overrides) {
  const script = 'const { env } = await import("./src/config/env.js"); console.log(JSON.stringify({ emailDriver: env.EMAIL_DRIVER, hooks: env.E2E_TEST_HOOKS }))'
  try {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      // A clean environment: the test runner's own NODE_ENV/EMAIL_DRIVER must not leak in.
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout, stderr: '' }
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

test('a valid production configuration starts with brevo mail and no test hooks', () => {
  const result = loadEnv(PRODUCTION_ENV)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout.trim()), { emailDriver: 'brevo', hooks: false })
})

test('production refuses to start with E2E_TEST_HOOKS enabled', () => {
  const result = loadEnv({ ...PRODUCTION_ENV, E2E_TEST_HOOKS: 'true' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /E2E_TEST_HOOKS/)
  assert.match(result.stderr, /never be enabled in production/)
})

test('production refuses to start with the capture email driver', () => {
  const result = loadEnv({ ...PRODUCTION_ENV, EMAIL_DRIVER: 'capture' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EMAIL_DRIVER/)
  assert.match(result.stderr, /never delivers mail/)
})

test('an unknown email driver is rejected in every environment', () => {
  const result = loadEnv({ ...PRODUCTION_ENV, NODE_ENV: 'development', EMAIL_DRIVER: 'smtp' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EMAIL_DRIVER/)
})

test('test environments may enable the hooks and the capture driver', () => {
  const result = loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://placeholder/unused',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    ADMIN_EMAIL: 'admin@signpak.test',
    ADMIN_PASSWORD: 'Admin@12345',
    E2E_TEST_HOOKS: 'true',
    EMAIL_DRIVER: 'capture',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout.trim()), { emailDriver: 'capture', hooks: true })
})

test('C3: production refuses to start without EMAIL_HASH_SECRET, or with a short one', () => {
  const { EMAIL_HASH_SECRET: _omitted, ...withoutSecret } = PRODUCTION_ENV
  const missing = loadEnv(withoutSecret)
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /EMAIL_HASH_SECRET/)
  assert.match(missing.stderr, /never change it/)
  assert.equal(loadEnv({ ...withoutSecret, EMAIL_HASH_SECRET: '' }).status, 1, 'an empty value counts as missing')
  assert.equal(loadEnv({ ...withoutSecret, EMAIL_HASH_SECRET: 'too-short' }).status, 1)
})

test('C3: outside production an empty EMAIL_HASH_SECRET falls back to the development key', () => {
  const { EMAIL_HASH_SECRET: _omitted, ...rest } = PRODUCTION_ENV
  const result = loadEnv({ ...rest, NODE_ENV: 'development', EMAIL_HASH_SECRET: '' })
  assert.equal(result.status, 0, result.stderr)
})
