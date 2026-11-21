import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { userRepo } from '../../src/repositories/userRepo.js'
import { auditService } from '../../src/services/auditService.js'
import { authService } from '../../src/services/authService.js'

/**
 * S7 / D5: at startup the accounts on ADMIN_EMAIL and ADMIN_EMAILS become admins and every
 * other admin goes back to a normal user, without ever leaving the site with no active admin.
 * The user repository is an in-memory list; audit entries are captured.
 */

const PRIMARY = 'admin@signpak.test'
let accounts
let audits

const account = (email, overrides = {}) => ({
  _id: `id-${email}`, id: `id-${email}`, email, role: 'user', status: 'active', emailVerified: true, ...overrides,
})

beforeEach(() => {
  audits = []
  mock.method(userRepo, 'findByEmails', async (emails) => accounts.filter((a) => emails.includes(a.email)))
  mock.method(userRepo, 'listAdmins', async () => accounts.filter((a) => a.role === 'admin'))
  mock.method(userRepo, 'save', async (doc) => doc)
  mock.method(auditService, 'record', async (entry) => { audits.push(entry) })
})

afterEach(() => mock.restoreAll())

const sync = (emails) => authService.syncAdmins({ primary: PRIMARY, emails })

describe('S7: admin list sync at startup', () => {
  test('S7: verified accounts on the list become admins; an unverified one does not', async () => {
    accounts = [
      account(PRIMARY, { role: 'admin' }),
      account('nida@example.com'),
      account('pending@example.com', { emailVerified: false }),
      account('sara@example.com'),
    ]
    const result = await sync([PRIMARY, 'nida@example.com', 'pending@example.com'])
    assert.deepEqual(result.promoted, ['id-nida@example.com'])
    assert.equal(accounts[1].role, 'admin')
    assert.equal(accounts[2].role, 'user', 'not promoted until the sign-up is finished')
    assert.equal(accounts[3].role, 'user', 'not on the list')
  })

  test('S7: admins not on the list go back to normal users', async () => {
    accounts = [account(PRIMARY, { role: 'admin' }), account('old@example.com', { role: 'admin' }), account('kept@example.com', { role: 'admin' })]
    const result = await sync([PRIMARY, 'kept@example.com'])
    assert.deepEqual(result.demoted, ['id-old@example.com'])
    assert.equal(accounts[1].role, 'user')
    assert.equal(accounts[2].role, 'admin')
  })

  test('S7: the ADMIN_EMAIL account is never demoted, even when ADMIN_EMAILS leaves it out', async () => {
    accounts = [account(PRIMARY, { role: 'admin' }), account('nida@example.com', { role: 'admin' })]
    const result = await sync(['nida@example.com'])
    assert.deepEqual(result.demoted, [])
    assert.equal(accounts[0].role, 'admin')
  })

  test('S7: the last active admin is never demoted', async () => {
    accounts = [
      account(PRIMARY, { role: 'admin', status: 'suspended' }),
      account('only@example.com', { role: 'admin' }),
    ]
    const result = await sync([PRIMARY])
    assert.deepEqual(result.demoted, [], 'demoting it would leave no active admin')
    assert.deepEqual(result.kept, ['id-only@example.com'])
    assert.equal(accounts[1].role, 'admin')
  })

  test('S7: a suspended admin off the list is demoted even when it is not the last', async () => {
    accounts = [account(PRIMARY, { role: 'admin' }), account('gone@example.com', { role: 'admin', status: 'suspended' })]
    assert.deepEqual((await sync([PRIMARY])).demoted, ['id-gone@example.com'])
  })

  test('S7: each promotion and demotion writes one audit entry with the system as actor', async () => {
    accounts = [account(PRIMARY, { role: 'admin' }), account('new@example.com'), account('old@example.com', { role: 'admin' })]
    await sync([PRIMARY, 'new@example.com'])
    assert.deepEqual(audits.map(({ actor, action, targetType, targetId }) => ({ actor, action, targetType, targetId })), [
      { actor: null, action: 'admin.promote', targetType: 'user', targetId: 'id-new@example.com' },
      { actor: null, action: 'admin.demote', targetType: 'user', targetId: 'id-old@example.com' },
    ])
    assert.equal(audits.some((entry) => JSON.stringify(entry.meta ?? {}).includes('@')), false, 'no email in meta')
  })

  test('S7: nothing changes when the accounts already match the list', async () => {
    accounts = [account(PRIMARY, { role: 'admin' }), account('nida@example.com', { role: 'admin' })]
    const result = await sync([PRIMARY, 'nida@example.com'])
    assert.deepEqual(result, { promoted: [], demoted: [], kept: [] })
    assert.equal(audits.length, 0)
  })
})
