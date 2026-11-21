import assert from 'node:assert/strict'
import { afterEach, describe, mock, test } from 'node:test'
import jwt from 'jsonwebtoken'
import '../support/helpers.js' // test environment before env.js loads
import { userRepo } from '../../src/repositories/userRepo.js'
import { authService } from '../../src/services/authService.js'
import { signConsentToken, verifyConsentToken } from '../../src/utils/tokens.js'

/**
 * B3: the sign-up consent token is bound to the account's authVersion when it was issued. A
 * re-signup bumps the version, so a token handed out before it can no longer finish (or
 * cancel) the sign-up.
 */

const EXPIRED = 'This sign-up step has expired. Verify your email again to continue.'
const pending = (authVersion) => ({ _id: 'user-1', id: 'user-1', role: 'user', emailVerified: false, authVersion })

afterEach(() => mock.restoreAll())

describe('B3: consent tokens carry the sign-up version', () => {
  test('B3: the token carries the version as claim v, and verifying returns it', () => {
    const token = signConsentToken('user-1', 3)
    const payload = jwt.decode(token)
    assert.equal(payload.v, 3)
    assert.equal(payload.purpose, 'signup-consent')
    assert.deepEqual(verifyConsentToken(token), { userId: 'user-1', v: 3 })
  })

  test('B3: a tampered or wrong-purpose token is rejected', () => {
    assert.equal(verifyConsentToken('garbage'), null)
    const notConsent = jwt.sign({ v: 0 }, process.env.JWT_SECRET, { subject: 'user-1', algorithm: 'HS256' })
    assert.equal(verifyConsentToken(notConsent), null)
  })

  test('B3: pendingSignup accepts a token for the current version', async () => {
    mock.method(userRepo, 'findById', async () => pending(2))
    const user = await authService.pendingSignup(signConsentToken('user-1', 2))
    assert.equal(user.id, 'user-1')
  })

  test('B3: pendingSignup refuses a token from before a re-signup (mismatched v)', async () => {
    mock.method(userRepo, 'findById', async () => pending(3))
    await assert.rejects(authService.pendingSignup(signConsentToken('user-1', 2)), (error) => error.status === 400 && error.message === EXPIRED)
  })

  test('B3: a token without v (issued before this change) counts as version 0', async () => {
    const legacy = jwt.sign({ purpose: 'signup-consent' }, process.env.JWT_SECRET, { subject: 'user-1', expiresIn: '30m', algorithm: 'HS256' })
    assert.deepEqual(verifyConsentToken(legacy), { userId: 'user-1', v: 0 })
    mock.method(userRepo, 'findById', async () => pending(1))
    await assert.rejects(authService.pendingSignup(legacy), (error) => error.status === 400)
  })
})
