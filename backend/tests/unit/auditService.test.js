import assert from 'node:assert/strict'
import { afterEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { auditRepo } from '../../src/repositories/auditRepo.js'
import { auditService, sanitizeMeta } from '../../src/services/auditService.js'
import { logger } from '../../src/utils/logger.js'

/**
 * S7: every admin action is written to the activity log. `meta` is a small object of
 * primitive values and never holds a secret or an email address.
 */

afterEach(() => mock.restoreAll())

describe('S7: the activity log entry', () => {
  test('S7: meta drops password, token, secret, hash, code, email, cookie and OTP keys', () => {
    const meta = sanitizeMeta({
      title: 'Hello', password: 'p', newPassword: 'p', token: 't', consentToken: 't', secret: 's',
      emailHash: 'h', code: '123456', email: 'a@b.c', contactEmail: 'a@b.c', cookie: 'c', otp: '1', status: 'done',
    })
    assert.deepEqual(meta, { title: 'Hello', status: 'done' })
  })

  test('S7: meta keeps only primitive values, cuts long strings and keeps at most 10 keys', () => {
    const many = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k${i}`, i]))
    assert.equal(Object.keys(sanitizeMeta(many)).length, 10)
    const meta = sanitizeMeta({ long: 'x'.repeat(500), nested: { a: 1 }, list: [1], fn: () => 1, flag: true, none: null, n: 3, missing: undefined })
    assert.equal(meta.long.length, 200)
    assert.deepEqual({ ...meta, long: undefined }, { long: undefined, flag: true, none: null, n: 3 })
    assert.deepEqual(sanitizeMeta(undefined), {})
  })

  test('S7: record writes the actor, action, target and cleaned meta', async () => {
    const created = []
    mock.method(auditRepo, 'create', async (data) => { created.push(data); return data })
    await auditService.record({ actor: { _id: 'admin-1' }, action: 'category.create', targetType: 'category', targetId: 42, meta: { label: 'Food', email: 'x@y.z' } })
    await auditService.record({ actor: null, action: 'admin.promote', targetType: 'user', targetId: 'u1' })
    assert.deepEqual(created, [
      { actorId: 'admin-1', action: 'category.create', targetType: 'category', targetId: '42', meta: { label: 'Food' } },
      { actorId: null, action: 'admin.promote', targetType: 'user', targetId: 'u1', meta: {} },
    ])
  })

  test('S7: a failed write is logged and does not fail the admin action', async () => {
    mock.method(auditRepo, 'create', async () => { throw new Error('database down') })
    const errors = []
    mock.method(logger, 'error', (...args) => { errors.push(args) })
    await assert.doesNotReject(auditService.record({ actor: { _id: 'a' }, action: 'video.delete', targetType: 'video', targetId: 'v1' }))
    assert.equal(errors.length, 1)
    assert.equal(errors[0][0].action, 'video.delete')
  })
})
