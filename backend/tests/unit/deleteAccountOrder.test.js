import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { deletedAccountRepo } from '../../src/repositories/deletionRepo.js'
import { submissionRepo } from '../../src/repositories/submissionRepo.js'
import { userRepo } from '../../src/repositories/userRepo.js'
import { auditService } from '../../src/services/auditService.js'
import { userService } from '../../src/services/userService.js'
import { logger } from '../../src/utils/logger.js'

/**
 * Phase 8 item 6: deleting an account removes the user first and only then writes the
 * DeletedAccount record, so a failed removal never leaves a "deleted" record for a live account.
 */

const ADMIN = { _id: 'admin-1', id: 'admin-1' }
let steps, errors

beforeEach(() => {
  steps = []
  errors = []
  mock.method(userRepo, 'findById', async () => ({ _id: 'user-1', id: 'user-1', email: 'sara@example.com', role: 'user', status: 'active' }))
  mock.method(userRepo, 'remove', async () => { steps.push('remove-user') })
  mock.method(deletedAccountRepo, 'create', async () => { steps.push('deleted-account') })
  mock.method(submissionRepo, 'clearCooldownsForUser', async () => { steps.push('cooldowns') })
  mock.method(auditService, 'record', async () => {})
  mock.method(logger, 'error', (...args) => { errors.push(args) })
})

afterEach(() => mock.restoreAll())

describe('Phase 8 item 6: deleteAccount order', () => {
  test('Phase 8 item 6: the user is removed first, then the DeletedAccount record is written', async () => {
    await userService.remove('user-1', ADMIN, {})
    assert.deepEqual(steps, ['remove-user', 'deleted-account', 'cooldowns'])
  })

  test('Phase 8 item 6: when the removal fails, no DeletedAccount record is written', async () => {
    userRepo.remove.mock.mockImplementation(async () => { throw new Error('database write failed') })
    await assert.rejects(userService.remove('user-1', ADMIN, {}), /database write failed/)
    assert.equal(steps.includes('deleted-account'), false)
  })

  test('Phase 8 item 6: a failed DeletedAccount write after the removal is logged, not thrown', async () => {
    deletedAccountRepo.create.mock.mockImplementation(async () => { throw new Error('insert failed') })
    await assert.doesNotReject(userService.remove('user-1', ADMIN, {}))
    assert.deepEqual(steps, ['remove-user', 'cooldowns'])
    assert.equal(errors.length, 1)
    assert.equal(errors[0][0].userId, 'user-1')
  })
})
