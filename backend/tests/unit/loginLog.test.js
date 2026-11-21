import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import bcrypt from 'bcrypt'
import '../support/helpers.js' // test environment before env.js loads
import { userRepo } from '../../src/repositories/userRepo.js'
import { authService } from '../../src/services/authService.js'
import { hashEmail } from '../../src/utils/emailHash.js'
import { logger } from '../../src/utils/logger.js'

/**
 * S7 (FIX-PLAN Phase 7 item 4): every login attempt is written to the server log at info level
 * with the email's keyed hash, the outcome and the IP. Never the password, never the email.
 */

const PASSWORD = 'password1'
const passwordHash = bcrypt.hashSync(PASSWORD, 4)
const IP = '203.0.113.7'
let account
let lines

beforeEach(() => {
  account = { _id: 'u1', id: 'u1', email: 'sara@example.com', passwordHash, authVersion: 0, status: 'active', emailVerified: true, failedLoginCount: 0, lockedUntil: null }
  lines = []
  mock.method(userRepo, 'findByEmail', async (email) => (email === account.email ? { ...account } : null))
  mock.method(userRepo, 'recordFailedLogin', async () => ({ locked: false }))
  mock.method(userRepo, 'clearLoginFailures', async () => {})
  mock.method(logger, 'info', (...args) => { lines.push(args) })
})

afterEach(() => mock.restoreAll())

async function attempt(email, password) {
  await authService.login({ email, password }, { ip: IP }).catch(() => {})
  const logins = lines.filter(([fields]) => fields?.event === 'login')
  assert.equal(logins.length, 1, 'one log line per attempt')
  const [[fields]] = logins
  const text = JSON.stringify(logins)
  assert.equal(text.includes(PASSWORD), false, 'never the password')
  assert.equal(text.includes('wrongpass1'), false, 'never a wrong password either')
  assert.equal(text.toLowerCase().includes(email.toLowerCase()), false, 'never the email itself')
  assert.equal(fields.emailHash, hashEmail(email))
  assert.equal(fields.ip, IP)
  return fields.outcome
}

describe('login attempts in the server log', () => {
  test('S7: a successful login is logged with the email hash, the IP and outcome success', async () => {
    assert.equal(await attempt('sara@example.com', PASSWORD), 'success')
  })

  test('S7: a wrong password is logged as wrong-password', async () => {
    assert.equal(await attempt('sara@example.com', 'wrongpass1'), 'wrong-password')
  })

  test('S7: an unknown email is logged as unknown-email', async () => {
    assert.equal(await attempt('nobody@example.com', 'wrongpass1'), 'unknown-email')
  })

  test('S7: a locked, suspended or unverified account is logged with that outcome', async () => {
    account.lockedUntil = new Date(Date.now() + 60_000)
    assert.equal(await attempt('sara@example.com', PASSWORD), 'locked')
    lines = []
    account.lockedUntil = null
    account.status = 'suspended'
    assert.equal(await attempt('sara@example.com', PASSWORD), 'suspended')
    lines = []
    account.status = 'active'
    account.emailVerified = false
    assert.equal(await attempt('sara@example.com', PASSWORD), 'unverified')
  })
})
