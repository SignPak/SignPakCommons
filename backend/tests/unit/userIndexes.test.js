import assert from 'node:assert/strict'
import { describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { env } from '../../src/config/env.js'
import { SIGNUP_TTL_INDEX, SIGNUP_TTL_MS, User } from '../../src/models/User.js'
import { userRepo } from '../../src/repositories/userRepo.js'

/** S9 and B2: the unfinished sign-up TTL index, and verified-only contributor counts. */

/** Whether a document matches the TTL index's partial filter (simple equality filter). */
const matchesFilter = (doc) => Object.entries(SIGNUP_TTL_INDEX.options.partialFilterExpression).every(([key, value]) => doc[key] === value)

describe('S9: unfinished sign-ups expire', () => {
  test('S9: the TTL index removes a document as soon as signupExpiresAt passes, 24 h after sign-up', () => {
    const [fields, options] = User.schema.indexes().find(([index]) => 'signupExpiresAt' in index)
    assert.deepEqual(fields, { signupExpiresAt: 1 })
    assert.equal(options.expireAfterSeconds, 0)
    assert.equal(SIGNUP_TTL_MS, 24 * 60 * 60 * 1000)
  })

  test('S9: the partial filter matches only unverified contributor accounts', () => {
    const [, options] = User.schema.indexes().find(([index]) => 'signupExpiresAt' in index)
    assert.deepEqual(options.partialFilterExpression, { emailVerified: false, role: 'user' })
    assert.equal(matchesFilter({ emailVerified: false, role: 'user' }), true)
    assert.equal(matchesFilter({ emailVerified: true, role: 'user' }), false, 'a finished sign-up')
    assert.equal(matchesFilter({ emailVerified: false, role: 'admin' }), false, 'an admin can never match')
    assert.equal(matchesFilter({ emailVerified: true, role: 'admin' }), false)
  })

  test('S9: the expiry is never sent to a client', () => {
    const json = new User({ email: 'a@b.co', firstName: 'A', surname: 'B', passwordHash: 'x', signupExpiresAt: new Date(), failedLoginCount: 2, lockedUntil: new Date() }).toJSON()
    for (const key of ['signupExpiresAt', 'failedLoginCount', 'lockedUntil']) assert.equal(key in json, false, key)
  })
})

describe('B2: contributor counts', () => {
  test('B2: countVerified counts only accounts that finished sign-up', async () => {
    const count = mock.method(User, 'countDocuments', async () => 3)
    assert.equal(await userRepo.countVerified('user'), 3)
    assert.deepEqual(count.mock.calls[0].arguments[0], { role: 'user', emailVerified: true })
    count.mock.restore()
  })
})

describe('code expiry', () => {
  test('codes last 10 minutes by default (FIX-PLAN section 0)', () => {
    assert.equal(env.AUTH_OTP_TTL_MINUTES, 10)
  })
})
