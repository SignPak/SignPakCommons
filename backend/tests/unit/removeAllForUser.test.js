import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { deletedAccountRepo, deletionLogRepo } from '../../src/repositories/deletionRepo.js'
import { submissionRepo } from '../../src/repositories/submissionRepo.js'
import { userRepo } from '../../src/repositories/userRepo.js'
import { submissionService } from '../../src/services/submissionService.js'
import { storageService } from '../../src/services/storage/index.js'
import { hashEmail } from '../../src/utils/emailHash.js'

/**
 * C3: submissionService.removeAllForUser with storage and every repository replaced, so the
 * rules are checked without a database or files.
 */

const USER_ID = '64b000000000000000000001'
const ADMIN = { _id: '64b0000000000000000000aa', id: '64b0000000000000000000aa' }
const submission = (n) => ({ _id: `sub-${n}`, recording: { driver: 'gdrive-archive', key: `file-${n}` } })

let logs, removedIds, cooldownsCleared

beforeEach(() => {
  logs = []
  removedIds = []
  cooldownsCleared = 0
  mock.method(submissionRepo, 'allForUser', async () => [submission(1), submission(2), submission(3)])
  mock.method(submissionRepo, 'removeMany', async (ids) => { removedIds.push(...ids) })
  mock.method(submissionRepo, 'clearCooldownsForUser', async () => { cooldownsCleared += 1 })
  mock.method(storageService, 'remove', async () => {})
  mock.method(userRepo, 'findById', async () => ({ _id: USER_ID, email: 'Sara@Example.com' }))
  mock.method(deletedAccountRepo, 'latestForUser', async () => null)
  mock.method(deletionLogRepo, 'create', async (data) => { logs.push(data); return data })
})

afterEach(() => mock.restoreAll())

describe('C3: removing every recording of one contributor', () => {
  test('C3: every file and document is removed, and the counts are returned', async () => {
    const result = await submissionService.removeAllForUser(USER_ID, ADMIN)
    assert.deepEqual(result, { deleted: 3, failed: [] })
    assert.equal(storageService.remove.mock.callCount(), 3)
    assert.deepEqual(removedIds, ['sub-1', 'sub-2', 'sub-3'])
    assert.equal(cooldownsCleared, 1)
  })

  test('C3: keeps going after one failed file, and keeps that file\'s document for a retry', async () => {
    storageService.remove.mock.mockImplementation(async (ref) => {
      if (ref.key === 'file-2') throw new Error('Drive said 500 with internal detail')
    })
    const result = await submissionService.removeAllForUser(USER_ID, ADMIN)
    assert.equal(result.deleted, 2)
    assert.equal(result.failed.length, 1)
    assert.equal(result.failed[0].id, 'sub-2')
    assert.equal(result.failed[0].reason.includes('internal detail'), false, 'the driver error is not passed on')
    assert.equal(storageService.remove.mock.callCount(), 3, 'the third file was still tried')
    assert.deepEqual(removedIds, ['sub-1', 'sub-3'])
  })

  test('C3: writes a deletion log with the counts and the email hash, never the email', async () => {
    await submissionService.removeAllForUser(USER_ID, ADMIN, { requestMessageId: '64b0000000000000000000cc' })
    assert.equal(logs.length, 1)
    const [log] = logs
    assert.equal(log.userId, USER_ID)
    assert.equal(log.adminId, ADMIN._id)
    assert.equal(log.deleted, 3)
    assert.equal(log.failed, 0)
    assert.equal(log.requestMessageId, '64b0000000000000000000cc')
    assert.equal(log.emailHash, hashEmail('sara@example.com'))
    assert.equal(JSON.stringify(log).toLowerCase().includes('sara@example.com'), false)
  })

  test('C3: for an account already deleted, the hash comes from its DeletedAccount record', async () => {
    userRepo.findById.mock.mockImplementation(async () => null)
    deletedAccountRepo.latestForUser.mock.mockImplementation(async () => ({ emailHash: 'f'.repeat(64) }))
    await submissionService.removeAllForUser(USER_ID, ADMIN)
    assert.equal(logs[0].emailHash, 'f'.repeat(64))
  })

  test('C3: with no submissions, no account and no deleted-account record, the user is not found', async () => {
    submissionRepo.allForUser.mock.mockImplementation(async () => [])
    userRepo.findById.mock.mockImplementation(async () => null)
    await assert.rejects(submissionService.removeAllForUser(USER_ID, ADMIN), (error) => error.status === 404)
    assert.equal(logs.length, 0)
  })

  // Phase 7 item 5 changed this rule. It used to log accountDeleted: true here, before the
  // account deletion had run; now the log is always written false and userService.remove marks
  // it once the account is really gone (see accountDeletionLog.test.js).
  test('C3: accountDeleted is never logged before the account deletion has happened', async () => {
    await submissionService.removeAllForUser(USER_ID, ADMIN, { accountDeletion: true })
    assert.equal(logs[0].accountDeleted, false, 'all files went, but the account is not deleted yet')
    storageService.remove.mock.mockImplementation(async () => { throw new Error('down') })
    await submissionService.removeAllForUser(USER_ID, ADMIN, { accountDeletion: true })
    assert.equal(logs[1].accountDeleted, false, 'files failed, so the account is kept')
  })
})
