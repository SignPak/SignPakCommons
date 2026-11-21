import assert from 'node:assert/strict'
import test from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { generateOtp, hashOtp, matchesOtp } from '../../src/utils/otp.js'

test('generateOtp returns six digits, never with a leading zero lost', () => {
  for (let index = 0; index < 200; index += 1) assert.match(generateOtp(), /^[1-9]\d{5}$/)
})

test('a code hash is bound to its purpose and subject', () => {
  const base = hashOtp('deletion-request', 'message-1', '123456')
  assert.match(base, /^[0-9a-f]{64}$/)
  assert.equal(hashOtp('deletion-request', 'message-1', '123456'), base, 'deterministic')
  assert.notEqual(hashOtp('email-verification', 'message-1', '123456'), base, 'another purpose')
  assert.notEqual(hashOtp('deletion-request', 'message-2', '123456'), base, 'another subject')
  assert.notEqual(hashOtp('deletion-request', 'message-1', '123457'), base, 'another code')
})

test('matchesOtp accepts only the right code for the right purpose and subject', () => {
  const stored = hashOtp('deletion-request', 'message-1', '654321')
  assert.equal(matchesOtp(stored, '654321', 'deletion-request', 'message-1'), true)
  assert.equal(matchesOtp(stored, '654322', 'deletion-request', 'message-1'), false)
  assert.equal(matchesOtp(stored, '654321', 'password-reset', 'message-1'), false)
  assert.equal(matchesOtp(stored, '654321', 'deletion-request', 'message-9'), false)
})

test('matchesOtp is false without a stored hash or with a malformed one', () => {
  assert.equal(matchesOtp(null, '123456', 'deletion-request', 'message-1'), false)
  assert.equal(matchesOtp('', '123456', 'deletion-request', 'message-1'), false)
  assert.equal(matchesOtp('abcd', '123456', 'deletion-request', 'message-1'), false, 'wrong length is a mismatch, not a crash')
})
