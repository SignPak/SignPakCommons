import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { hashEmail } from '../../src/utils/emailHash.js'

test('C3: the email hash ignores case and surrounding spaces', () => {
  const base = hashEmail('sara@example.com')
  assert.match(base, /^[0-9a-f]{64}$/)
  assert.equal(hashEmail('  Sara@Example.COM '), base)
})

test('C3: different addresses get different hashes', () => {
  assert.notEqual(hashEmail('sara@example.com'), hashEmail('sara@example.org'))
})

test('C3: the hash is keyed, not a plain SHA-256 that an address list could reverse', () => {
  const plain = createHash('sha256').update('sara@example.com').digest('hex')
  assert.notEqual(hashEmail('sara@example.com'), plain)
  assert.equal(hashEmail('sara@example.com').includes('sara'), false)
})

test('C3: an empty or missing address is refused rather than hashed', () => {
  assert.throws(() => hashEmail(''), /email/)
  assert.throws(() => hashEmail(null), /email/)
})
