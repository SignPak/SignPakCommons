import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import bcrypt from 'bcrypt'
import '../support/helpers.js' // test environment before env.js loads
import { env } from '../../src/config/env.js'
import { userRepo } from '../../src/repositories/userRepo.js'
import { authService } from '../../src/services/authService.js'

/**
 * S2 / SE-4: the login lockout, with the user repository replaced by an in-memory account and
 * Date replaced by a fake clock, so "15 minutes later" needs no waiting. The repository fake
 * follows the same rules as userRepo.recordFailedLogin.
 */

const PASSWORD = 'password1'
const passwordHash = bcrypt.hashSync(PASSWORD, 4)
let account

beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-21T10:00:00Z') })
  account = {
    _id: 'user-1', id: 'user-1', email: 'sara@example.com', passwordHash, authVersion: 0,
    status: 'active', emailVerified: true, failedLoginCount: 0, lockedUntil: null,
  }
  mock.method(userRepo, 'findByEmail', async (email) => (email === account.email ? { ...account } : null))
  mock.method(userRepo, 'recordFailedLogin', async (id, { attempts, lockMs }) => {
    const now = new Date()
    if (account.lockedUntil && account.lockedUntil <= now) Object.assign(account, { lockedUntil: null, failedLoginCount: 0 })
    account.failedLoginCount += 1
    if (account.failedLoginCount < attempts) return { locked: false }
    Object.assign(account, { lockedUntil: new Date(now.getTime() + lockMs), failedLoginCount: 0 })
    return { locked: true, lockedUntil: account.lockedUntil }
  })
  mock.method(userRepo, 'clearLoginFailures', async () => Object.assign(account, { failedLoginCount: 0, lockedUntil: null }))
})

afterEach(() => {
  mock.timers.reset()
  mock.restoreAll()
})

const login = (password) => authService.login({ email: 'sara@example.com', password })
const refusedWith = (promise, status, code) => assert.rejects(promise, (error) => error.status === status && (!code || error.code === code))
const minutes = (n) => mock.timers.tick(n * 60_000)

describe('S2: login lockout', () => {
  test('S2: the defaults are 5 attempts and 15 minutes', () => {
    assert.equal(env.AUTH_LOCKOUT_ATTEMPTS, 5)
    assert.equal(env.AUTH_LOCKOUT_MINUTES, 15)
  })

  test('S2: four wrong passwords are plain 401s, the fifth locks the account', async () => {
    for (let n = 1; n <= 4; n += 1) await refusedWith(login('wrong'), 401)
    await assert.rejects(login('wrong'), (error) =>
      error.status === 429 && error.code === 'ACCOUNT_LOCKED' && error.message === 'Too many failed attempts. Try again in 15 minutes.')
    assert.equal(account.lockedUntil.toISOString(), '2026-11-21T10:15:00.000Z')
  })

  test('S2: while locked even the right password is refused', async () => {
    for (let n = 1; n <= 5; n += 1) await login('wrong').catch(() => {})
    minutes(14)
    await refusedWith(login(PASSWORD), 429, 'ACCOUNT_LOCKED')
  })

  test('S2: once the lock has passed the right password works and clears it', async () => {
    for (let n = 1; n <= 5; n += 1) await login('wrong').catch(() => {})
    minutes(15)
    const { user, token } = await login(PASSWORD)
    assert.equal(user.email, 'sara@example.com')
    assert.ok(token)
    assert.equal(account.lockedUntil, null)
    assert.equal(account.failedLoginCount, 0)
  })

  test('S2: after a lock has passed, the count starts again from zero', async () => {
    for (let n = 1; n <= 5; n += 1) await login('wrong').catch(() => {})
    minutes(16)
    for (let n = 1; n <= 4; n += 1) await refusedWith(login('wrong'), 401)
    await refusedWith(login('wrong'), 429, 'ACCOUNT_LOCKED')
  })

  test('S2: a successful login resets the count', async () => {
    for (let n = 1; n <= 4; n += 1) await login('wrong').catch(() => {})
    await login(PASSWORD)
    assert.equal(account.failedLoginCount, 0)
    for (let n = 1; n <= 4; n += 1) await refusedWith(login('wrong'), 401)
  })

  test('S2: an unknown email still runs bcrypt (timing) and is never locked', async () => {
    const compare = mock.method(bcrypt, 'compare')
    for (let n = 1; n <= 6; n += 1) await refusedWith(authService.login({ email: 'nobody@example.com', password: 'x' }), 401)
    assert.equal(compare.mock.callCount(), 6)
    assert.equal(userRepo.recordFailedLogin.mock.callCount(), 0)
  })
})
