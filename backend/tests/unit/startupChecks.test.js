import assert from 'node:assert/strict'
import test from 'node:test'
import { startupWarnings } from '../../src/config/startupChecks.js'

test('S3: warns when TRUST_PROXY is off in production', () => {
  const warnings = startupWarnings({ isProduction: true, TRUST_PROXY: false })
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /TRUST_PROXY is off in production/)
  assert.match(warnings[0], /Set TRUST_PROXY=true/)
})

test('S3: no proxy warning in production when TRUST_PROXY is on', () => {
  assert.deepEqual(startupWarnings({ isProduction: true, TRUST_PROXY: true }), [])
})

test('S3: no proxy warning outside production', () => {
  assert.deepEqual(startupWarnings({ isProduction: false, TRUST_PROXY: false }), [])
})

test('D1: in a container, a loopback HOST in production is warned about', () => {
  // Phase 11 (Coolify): inside a container 127.0.0.1 is the container's own loopback, so
  // Traefik cannot reach the API even though the image's own health check passes.
  const production = { isProduction: true, TRUST_PROXY: true }
  for (const HOST of ['127.0.0.1', '::1']) {
    const warnings = startupWarnings({ ...production, HOST }, { inContainer: true })
    assert.equal(warnings.length, 1, `HOST=${HOST}`)
    assert.match(warnings[0], /HOST=0\.0\.0\.0/)
  }
  assert.deepEqual(startupWarnings({ ...production, HOST: '0.0.0.0' }, { inContainer: true }), [])
  assert.deepEqual(startupWarnings({ ...production, HOST: '127.0.0.1' }, { inContainer: false }), [])
  assert.deepEqual(startupWarnings({ ...production, HOST: '127.0.0.1' }), [])
  assert.deepEqual(startupWarnings({ isProduction: false, TRUST_PROXY: false, HOST: '127.0.0.1' }, { inContainer: true }), [])
})
