import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { deletedAccountRepo, deletionLogRepo } from '../../src/repositories/deletionRepo.js'
import { submissionRepo } from '../../src/repositories/submissionRepo.js'
import { userRepo } from '../../src/repositories/userRepo.js'
import { auditService } from '../../src/services/auditService.js'
import { submissionService } from '../../src/services/submissionService.js'
import { userService } from '../../src/services/userService.js'

/**
 * Phase 7 item 5: an admin deleting an account with its recordings. The DeletionLog is written
 * with accountDeleted false and marked true only after the account deletion has succeeded.
 */

const USER = { _id: 'user-1', id: 'user-1', email: 'sara@example.com', role: 'user', status: 'active' }
const ADMIN = { _id: 'admin-1', id: 'admin-1' }
let steps

beforeEach(() => {
  steps = []
  mock.method(userRepo, 'findById', async () => ({ ...USER }))
  mock.method(submissionService, 'removeRecordings', async () => { steps.push('recordings'); return { deleted: 2, failed: [], log: { _id: 'log-1', accountDeleted: false } } })
  mock.method(deletedAccountRepo, 'create', async () => { steps.push('deleted-account') })
  mock.method(submissionRepo, 'clearCooldownsForUser', async () => {})
  mock.method(userRepo, 'remove', async () => { steps.push('remove-user') })
  mock.method(deletionLogRepo, 'markAccountDeleted', async (id) => { steps.push(`mark ${id}`) })
  mock.method(auditService, 'record', async ({ action }) => { steps.push(`audit ${action}`) })
})

afterEach(() => mock.restoreAll())

describe('Phase 7 item 5: DeletionLog.accountDeleted', () => {
  test('Phase 7 item 5: the log is marked accountDeleted only after the account is deleted', async () => {
    await userService.remove('user-1', ADMIN, { withRecordings: true })
    // Phase 8 item 6 put the user removal before the DeletedAccount record.
    assert.deepEqual(steps, ['recordings', 'remove-user', 'deleted-account', 'mark log-1', 'audit user.delete'])
  })

  test('Phase 7 item 5: when the account deletion fails, the log is never marked', async () => {
    userRepo.remove.mock.mockImplementation(async () => { throw new Error('database write failed') })
    await assert.rejects(userService.remove('user-1', ADMIN, { withRecordings: true }), /database write failed/)
    assert.equal(steps.some((step) => step.startsWith('mark')), false)
    assert.equal(steps.includes('audit user.delete'), false, 'no activity entry for a deletion that did not happen')
  })

  test('Phase 7 item 5: a plain account deletion writes no deletion log', async () => {
    await userService.remove('user-1', ADMIN, {})
    assert.deepEqual(steps, ['remove-user', 'deleted-account', 'audit user.delete'])
  })
})
