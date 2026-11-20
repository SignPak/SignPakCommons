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
