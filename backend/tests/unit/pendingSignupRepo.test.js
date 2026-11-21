import assert from 'node:assert/strict'
import { afterEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { User } from '../../src/models/User.js'
import { userRepo, versionMatch } from '../../src/repositories/userRepo.js'

/**
 * B3 (second fixes after verification): a re-signup and a consent or decline for the same
 * unfinished sign-up must not both succeed. Each side writes only if the account is still
 * unfinished and still at the version it checked, in one conditional update, so exactly one
 * of them can win.
 */

afterEach(() => mock.restoreAll())

// Records what the repo sends to MongoDB, instead of running the query.
const capture = (method, result = null) => {
  const calls = []
  mock.method(User, method, (...args) => {
    calls.push(args)
    const query = { select: (fields) => { calls.at(-1).select = fields; return query }, then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
    return query
  })
  return calls
}

describe('B3: conditional writes for unfinished sign-ups', () => {
  test('B3: versionMatch(0) also matches an account with no authVersion field; other versions match exactly', () => {
    assert.deepEqual(versionMatch(0), { $in: [0, null] })
    assert.deepEqual(versionMatch(undefined), { $in: [0, null] })
    assert.equal(versionMatch(1), 1)
    assert.equal(versionMatch(7), 7)
  })

  test('B3: updatePendingSignup only updates an unfinished user sign-up at the expected version, bumps the version and selects the code fields', async () => {
    const calls = capture('findOneAndUpdate', { id: 'u1' })
    const fields = { firstName: 'A', surname: 'B', passwordHash: 'h', signupExpiresAt: new Date(0) }
    assert.deepEqual(await userRepo.updatePendingSignup('u1', 2, fields), { id: 'u1' })
    const [[filter, update, options]] = calls
    assert.deepEqual(filter, { _id: 'u1', emailVerified: false, role: 'user', authVersion: 2 })
    assert.deepEqual(update, { $set: fields, $inc: { authVersion: 1 } })
    assert.equal(options.new, true)
    assert.match(calls[0].select, /\+emailVerificationCodeHash/)
    assert.match(calls[0].select, /\+emailVerificationSentAt/)
  })

  test('B3: completePendingSignup only finishes an unfinished user sign-up at the token\'s version', async () => {
    const calls = capture('findOneAndUpdate', null)
    const consent = { acceptedAt: new Date(0), version: 'v1' }
    assert.equal(await userRepo.completePendingSignup('u1', 0, { consent }), null)
    const [[filter, update, options]] = calls
    assert.deepEqual(filter, { _id: 'u1', emailVerified: false, role: 'user', authVersion: { $in: [0, null] } })
    assert.deepEqual(update, { $set: { emailVerified: true, consent, signupExpiresAt: null } })
    assert.equal(options.new, true)
  })

  test('B3: removePendingSignup deletes only an unfinished user sign-up at the token\'s version', async () => {
    const calls = []
    mock.method(User, 'deleteOne', async (filter) => { calls.push(filter); return { deletedCount: 0 } })
    assert.deepEqual(await userRepo.removePendingSignup('u1', 3), { deletedCount: 0 })
    assert.deepEqual(calls, [{ _id: 'u1', emailVerified: false, role: 'user', authVersion: 3 }])
  })
})
