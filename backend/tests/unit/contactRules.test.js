import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, mock, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { contactQuotaRepo } from '../../src/repositories/contactQuotaRepo.js'
import { messageRepo } from '../../src/repositories/messageRepo.js'
import { userRepo } from '../../src/repositories/userRepo.js'
import { accessRestrictionService } from '../../src/services/accessRestrictionService.js'
import { contactService } from '../../src/services/contactService.js'
import { emailService } from '../../src/services/email/index.js'
import { hashOtp } from '../../src/utils/otp.js'

/**
 * The contact rules (FIX-PLAN section 0, S4, D4) with every repository, the email driver and
 * the Web3Forms call replaced, so each rule is checked on its own and no database is needed.
 */

const USER = { _id: 'user-1', email: 'sara@example.com' }
const SIGNED_OUT = { user: null, ip: '203.0.113.7', deviceId: 'device-1' }
const SIGNED_IN = { user: USER, ip: '203.0.113.7', deviceId: 'device-1' }
const general = { topic: 'general', name: 'Sara', email: 'sara@example.com', message: 'Hello' }
const deletion = (email = 'sara@example.com') => ({ topic: 'recording-deletion', name: 'Sara', email, message: 'Delete my data' })

let quota, created, deliveries, emails, saved, originalDeliver

/** A stored deletion request as findForVerification returns it. */
const requestDoc = (fields = {}) => ({
  _id: 'message-1',
  topic: 'recording-deletion',
  email: 'sara@example.com',
  user: null,
  verified: false,
  verificationCodeHash: null,
  verificationExpiresAt: null,
  verificationAttempts: 0,
  verificationSentAt: null,
  ...fields,
})

const flush = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
  quota = { user: true, daily: true, sender: new Map(), released: [] }
  created = []
  deliveries = []
  emails = []
  saved = []
  mock.method(contactQuotaRepo, 'claimUser', async () => quota.user)
  mock.method(contactQuotaRepo, 'releaseUser', async () => quota.released.push('user'))
  mock.method(contactQuotaRepo, 'claimDaily', async () => quota.daily)
  mock.method(contactQuotaRepo, 'releaseDaily', async () => quota.released.push('daily'))
  mock.method(contactQuotaRepo, 'claimSender', async (key, day, maximum) => {
    const used = quota.sender.get(key) ?? 0
    if (used >= maximum) return false
    quota.sender.set(key, used + 1)
    return true
  })
  mock.method(contactQuotaRepo, 'releaseSender', async (key) => {
    quota.sender.set(key, quota.sender.get(key) - 1)
    quota.released.push('sender')
  })
  mock.method(messageRepo, 'create', async (data) => {
    const doc = { _id: `message-${created.length + 1}`, ...data }
    created.push(doc)
    return doc
  })
  mock.method(messageRepo, 'remove', async () => {})
  mock.method(messageRepo, 'save', async (doc) => saved.push({ ...doc }))
  mock.method(emailService, 'sendOtp', async (email, code, purpose) => emails.push({ email, code, purpose }))
  mock.method(accessRestrictionService, 'create', async () => assert.fail('contact rules must never create a restriction'))
  originalDeliver = contactService.deliver
  contactService.deliver = async (payload) => deliveries.push(payload)
})

afterEach(() => {
  mock.restoreAll()
  contactService.deliver = originalDeliver
})

const rejectsWith = (promise, status) => assert.rejects(promise, (error) => error.status === status)

describe('S4: refusals are plain answers, never blocks', () => {
  test('S4: a signed-out general message is refused with 403 before any quota is touched', async () => {
    await rejectsWith(contactService.send(general, SIGNED_OUT), 403)
    assert.equal(contactQuotaRepo.claimSender.mock.callCount(), 0)
    assert.equal(created.length, 0)
  })

  test('S4: a signed-in message from another email is refused with 403', async () => {
    await rejectsWith(contactService.send({ ...general, email: 'other@example.com' }, SIGNED_IN), 403)
    assert.equal(created.length, 0)
  })

  test('S4: the site-wide cap answers 429 and releases the user quota it claimed', async () => {
    quota.daily = false
    await rejectsWith(contactService.send(general, SIGNED_IN), 429)
    assert.deepEqual(quota.released, ['user'])
  })

  test('S4: deletion requests never touch the site-wide cap', async () => {
    quota.daily = false
    assert.equal((await contactService.send(deletion(), SIGNED_IN)).received, true)
    assert.equal((await contactService.send(deletion('former@example.com'), SIGNED_OUT)).received, true)
    assert.equal(contactQuotaRepo.claimDaily.mock.callCount(), 0)
  })

  test('S4: signed-out deletion requests are limited per IP and per device (default two a day)', async () => {
    await contactService.send(deletion('a@example.com'), SIGNED_OUT)
    await contactService.send(deletion('b@example.com'), SIGNED_OUT)
    await rejectsWith(contactService.send(deletion('c@example.com'), SIGNED_OUT), 429)
    // A new device on the same IP is still over the IP limit...
    await rejectsWith(contactService.send(deletion('d@example.com'), { ...SIGNED_OUT, deviceId: 'device-2' }), 429)
    // ...and the same device on a new IP is still over the device limit.
    await rejectsWith(contactService.send(deletion('e@example.com'), { ...SIGNED_OUT, ip: '198.51.100.1' }), 429)
    assert.equal(created.length, 2)
  })

  test('S4: the per-sender keys are keyed hashes, never the raw IP or device ID', async () => {
    await contactService.send(deletion(), SIGNED_OUT)
    const keys = contactQuotaRepo.claimSender.mock.calls.map((call) => call.arguments[0])
    assert.equal(keys.length, 2)
    for (const key of keys) {
      assert.match(key, /^[0-9a-f]{64}$/)
      assert.equal(key.includes('203.0.113.7') || key.includes('device-1'), false)
    }
  })

  test('S4: a failed forward removes the message and releases every quota it claimed', async () => {
    contactService.deliver = async () => { throw new Error('provider unavailable') }
    await assert.rejects(contactService.send(deletion(), SIGNED_OUT))
    assert.equal(messageRepo.remove.mock.callCount(), 1)
    assert.deepEqual(quota.released, ['sender', 'sender'])
    assert.deepEqual([...quota.sender.values()], [0, 0])
  })
})

describe('D4: deletion requests', () => {
  test('D4: a signed-in deletion request is verified at once and skips the one-a-day quota', async () => {
    const result = await contactService.send(deletion(), SIGNED_IN)
    assert.deepEqual(result, { received: true, id: 'message-1', verificationRequired: false })
    assert.equal(created[0].verified, true)
    assert.equal(contactQuotaRepo.claimUser.mock.callCount(), 0)
    assert.equal(deliveries[0].verification, 'verified')
  })

  test('D4: a signed-out deletion request is saved unverified with a send time, and forwarded as pending', async () => {
    mock.method(messageRepo, 'findForVerification', async () => null)
    const result = await contactService.send(deletion('former@example.com'), SIGNED_OUT)
    assert.deepEqual(result, { received: true, id: 'message-1', verificationRequired: true })
    assert.equal(created[0].verified, false)
    assert.ok(created[0].verificationSentAt instanceof Date)
    assert.equal(deliveries[0].verification, 'verification pending')
  })

  test('D4: a code is emailed when an account uses the email, and none otherwise', async () => {
    const withAccount = requestDoc()
    mock.method(messageRepo, 'findForVerification', async () => withAccount)
    mock.method(userRepo, 'findByEmail', async () => ({ _id: 'user-1' }))
    assert.equal(await contactService.issueCode('message-1'), true)
    assert.equal(emails.length, 1)
    assert.equal(emails[0].purpose, 'deletion-request')
    assert.match(withAccount.verificationCodeHash, /^[0-9a-f]{64}$/)
    assert.ok(withAccount.verificationExpiresAt > new Date())

    const withoutAccount = requestDoc({ email: 'nobody@example.com' })
    messageRepo.findForVerification.mock.mockImplementation(async () => withoutAccount)
    userRepo.findByEmail.mock.mockImplementation(async () => null)
    assert.equal(await contactService.issueCode('message-1'), false)
    assert.equal(emails.length, 1, 'no second email')
    assert.equal(withoutAccount.verificationCodeHash, null)
    assert.ok(withoutAccount.verificationSentAt instanceof Date, 'the send time is still recorded')
  })

  test('D4: the send answer is identical with and without an account', async () => {
    mock.method(messageRepo, 'findForVerification', async () => requestDoc())
    mock.method(userRepo, 'findByEmail', async () => ({ _id: 'user-1' }))
    const withAccount = await contactService.send(deletion('sara@example.com'), SIGNED_OUT)
    userRepo.findByEmail.mock.mockImplementation(async () => null)
    const withoutAccount = await contactService.send(deletion('nobody@example.com'), { ...SIGNED_OUT, ip: '198.51.100.2', deviceId: 'device-9' })
    assert.deepEqual({ ...withAccount, id: null }, { ...withoutAccount, id: null })
    await flush()
  })

  test('D4: the right code verifies the request and clears the code', async () => {
    const doc = requestDoc({ verificationCodeHash: hashOtp('deletion-request', 'message-1', '424242'), verificationExpiresAt: new Date(Date.now() + 60_000) })
    mock.method(messageRepo, 'findForVerification', async () => doc)
    assert.deepEqual(await contactService.verify('message-1', '424242'), { verified: true })
    assert.equal(doc.verified, true)
    assert.equal(doc.verificationCodeHash, null)
  })

  test('D4: an expired code is refused with the generic 400', async () => {
    const doc = requestDoc({ verificationCodeHash: hashOtp('deletion-request', 'message-1', '424242'), verificationExpiresAt: new Date(Date.now() - 1) })
    mock.method(messageRepo, 'findForVerification', async () => doc)
    await rejectsWith(contactService.verify('message-1', '424242'), 400)
    assert.equal(doc.verified, false)
  })

  test('D4: the fifth wrong attempt clears the code', async () => {
    const doc = requestDoc({ verificationCodeHash: hashOtp('deletion-request', 'message-1', '424242'), verificationExpiresAt: new Date(Date.now() + 60_000) })
    mock.method(messageRepo, 'findForVerification', async () => doc)
    for (let n = 1; n <= 5; n += 1) {
      await rejectsWith(contactService.verify('message-1', '000000'), 400)
      assert.equal(doc.verificationAttempts, n)
    }
    assert.equal(doc.verificationCodeHash, null)
    await rejectsWith(contactService.verify('message-1', '424242'), 400)
  })

  test('D4: an unknown id, a non-deletion message and a request with no code all give the same 400', async () => {
    mock.method(messageRepo, 'findForVerification', async () => null)
    await rejectsWith(contactService.verify('missing', '123456'), 400)
    messageRepo.findForVerification.mock.mockImplementation(async () => requestDoc({ topic: 'general' }))
    await rejectsWith(contactService.verify('message-1', '123456'), 400)
    messageRepo.findForVerification.mock.mockImplementation(async () => requestDoc())
    await rejectsWith(contactService.verify('message-1', '123456'), 400)
  })

  test('D4: resend waits a minute after the last send, then claims the send time and answers the same for everyone', async () => {
    const doc = requestDoc({ verificationSentAt: new Date() })
    mock.method(messageRepo, 'findForVerification', async () => doc)
    mock.method(userRepo, 'findByEmail', async () => null)
    await rejectsWith(contactService.resend('message-1'), 429)

    doc.verificationSentAt = new Date(Date.now() - 61_000)
    const answer = await contactService.resend('message-1')
    assert.deepEqual(answer, { message: 'If an account uses this email, a new code is on its way.' })
    assert.ok(Date.now() - doc.verificationSentAt.getTime() < 5_000, 'the send time moved forward at once')
    await rejectsWith(contactService.resend('message-1'), 429)
    await flush()
  })

  test('D4: resend is refused for signed-in or verified requests', async () => {
    mock.method(messageRepo, 'findForVerification', async () => requestDoc({ verified: true }))
    await rejectsWith(contactService.resend('message-1'), 400)
    messageRepo.findForVerification.mock.mockImplementation(async () => requestDoc({ user: 'user-1' }))
    await rejectsWith(contactService.resend('message-1'), 400)
  })
})
