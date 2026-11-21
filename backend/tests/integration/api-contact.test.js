import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { listCapturedEmails } from '../../src/services/email/index.js'
import { contactSenderKey } from '../../src/services/contactService.js'

/**
 * Phase 4: the contact form (C2's API side), no automatic blocks (S4) and verified deletion
 * requests (D4), through the real HTTP stack with the capture email driver.
 */

const getContext = useApiContext({ after })
let base, admin, contributor, createVerifiedUser, deliveredCodes, contactDeliveries, mongoose

const deletion = (email, extra = {}) => ({
  topic: 'recording-deletion',
  name: 'Former contributor',
  email,
  message: 'Please delete my recordings and contribution data.',
  ...extra,
})

/** The code is emailed in the background, after the response; wait for it to arrive. */
async function codeFor(email, { previous } = {}) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = deliveredCodes.get(`${email}:deletion-request`)
    if (code && code !== previous) return code
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return undefined
}

const stored = (id) => mongoose.models.ContactMessage.findById(id)
  .select('+verificationCodeHash +verificationExpiresAt +verificationAttempts +verificationSentAt')
const healthFor = (deviceId) => new Client(base).get('/health', { headers: { 'x-device-id': deviceId } })
// Every test request comes from 127.0.0.1, so clear the per-sender quota between cases.
const resetSenderQuota = () => mongoose.models.ContactSenderQuota.deleteMany({})
const ageLastSend = (id) => mongoose.models.ContactMessage.updateOne({ _id: id }, { $set: { verificationSentAt: new Date(Date.now() - 61_000) } })

before(async () => {
  ;({ base, admin, contributor, createVerifiedUser, deliveredCodes, contactDeliveries, mongoose } = await getContext())
})
beforeEach(resetSenderQuota)

describe('contact form: S4, no automatic blocks', () => {
  test('S4: a signed-out general message gets 403 and the device is not blocked afterwards', async () => {
    const response = await new Client(base).post('/contact', { topic: 'general', name: 'Guest', email: 'guest@example.com', message: 'Hello' }, { headers: { 'x-device-id': 'device-s4-general' } })
    assert.equal(response.status, 403)
    assert.equal(response.body.error.code, 'FORBIDDEN')
    assert.equal((await healthFor('device-s4-general')).status, 200)
    assert.equal(await mongoose.models.AccessRestriction.countDocuments(), 0)
  })

  test('S4: a signed-in message from another email gets 403 and the device is not blocked', async () => {
    const response = await contributor.post('/contact', { name: 'Sara Ahmed', email: 'someone-else@example.com', message: 'Typo' }, { headers: { 'x-device-id': 'device-s4-mismatch' } })
    assert.equal(response.status, 403)
    assert.equal((await healthFor('device-s4-mismatch')).status, 200)
  })

  test('S4: the site-wide cap answers 429 without blocking, and deletion requests are exempt from it', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await mongoose.models.ContactDailyQuota.findByIdAndUpdate(today, { count: 25 }, { upsert: true })
    try {
      const capped = await createVerifiedUser({ firstName: 'Cap', surname: 'Tester', email: 'cap@example.com' })
      const response = await capped.post('/contact', { name: 'Cap Tester', email: 'cap@example.com', message: 'Over the cap' }, { headers: { 'x-device-id': 'device-s4-cap' } })
      assert.equal(response.status, 429)
      assert.equal((await healthFor('device-s4-cap')).status, 200)

      const signedOut = await new Client(base).post('/contact', deletion('cap-free@example.com'))
      assert.equal(signedOut.status, 201, 'a signed-out deletion request still goes through at the cap')
      const signedIn = await capped.post('/contact', deletion('cap@example.com', { name: 'Cap Tester' }))
      assert.equal(signedIn.status, 201, 'a signed-in deletion request still goes through at the cap')
    } finally {
      await mongoose.models.ContactDailyQuota.deleteOne({ _id: today })
    }
  })

  test('S4: two signed-out deletion requests a day per IP; the third gets 429 and nothing is blocked', async () => {
    const visitor = new Client(base)
    for (const n of [1, 2]) {
      assert.equal((await visitor.post('/contact', deletion(`ip-limit-${n}@example.com`), { headers: { 'x-device-id': `device-ip-${n}` } })).status, 201)
    }
    const third = await visitor.post('/contact', deletion('ip-limit-3@example.com'), { headers: { 'x-device-id': 'device-ip-3' } })
    assert.equal(third.status, 429)
    assert.equal(third.body.error.code, 'TOO_MANY_REQUESTS')
    assert.equal((await healthFor('device-ip-3')).status, 200)
  })

  test('S4: a failed forward releases the sender quota', async () => {
    const visitor = new Client(base)
    for (let n = 0; n < 3; n += 1) {
      assert.equal((await visitor.post('/contact', deletion('provider@example.com', { message: 'Provider failure' }))).status, 500)
    }
    assert.equal((await visitor.post('/contact', deletion('provider@example.com'))).status, 201)
    assert.equal((await visitor.post('/contact', deletion('provider@example.com'))).status, 201)
  })
})

describe('deletion requests: D4, verified by code', () => {
  test('D4: a signed-out request for an account is saved unverified, a code is emailed, and the code verifies it', async () => {
    await createVerifiedUser({ firstName: 'Dana', surname: 'Code', email: 'dana@example.com' })
    const sent = await new Client(base).post('/contact', deletion('dana@example.com'))
    assert.equal(sent.status, 201)
    assert.deepEqual(Object.keys(sent.body.data).sort(), ['id', 'received', 'verificationRequired'])
    assert.equal(sent.body.data.verificationRequired, true)
    const { id } = sent.body.data
    assert.equal((await stored(id)).verified, false)
    assert.equal(contactDeliveries.at(-1).verification, 'verification pending')

    const code = await codeFor('dana@example.com')
    assert.match(code, /^\d{6}$/)
    const verified = await new Client(base).post(`/contact/${id}/verify`, { code })
    assert.equal(verified.status, 200)
    assert.deepEqual(verified.body.data, { verified: true })
    const after = await stored(id)
    assert.equal(after.verified, true)
    assert.equal(after.verificationCodeHash, null, 'the code is cleared once used')

    assert.equal((await new Client(base).post(`/contact/${id}/verify`, { code })).status, 200, 'verifying again is harmless')
  })

  test('D4: five wrong codes kill the code, so even the right one fails afterwards', async () => {
    await createVerifiedUser({ firstName: 'Eli', surname: 'Guess', email: 'eli@example.com' })
    const { id } = (await new Client(base).post('/contact', deletion('eli@example.com'))).body.data
    const code = await codeFor('eli@example.com')
    const wrong = code === '111111' ? '222222' : '111111'
    for (let n = 0; n < 5; n += 1) {
      const attempt = await new Client(base).post(`/contact/${id}/verify`, { code: wrong })
      assert.equal(attempt.status, 400)
      assert.equal(attempt.body.error.code, 'BAD_REQUEST')
    }
    assert.equal((await new Client(base).post(`/contact/${id}/verify`, { code })).status, 400)
    assert.equal((await stored(id)).verified, false)
  })

  test('D4: an expired code is refused', async () => {
    await createVerifiedUser({ firstName: 'Fay', surname: 'Late', email: 'fay@example.com' })
    const { id } = (await new Client(base).post('/contact', deletion('fay@example.com'))).body.data
    const code = await codeFor('fay@example.com')
    await mongoose.models.ContactMessage.updateOne({ _id: id }, { $set: { verificationExpiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await new Client(base).post(`/contact/${id}/verify`, { code })).status, 400)
  })

  test('D4: resend is refused within a minute of the last send, then sends a new code', async () => {
    await createVerifiedUser({ firstName: 'Gul', surname: 'Again', email: 'gul@example.com' })
    const { id } = (await new Client(base).post('/contact', deletion('gul@example.com'))).body.data
    const first = await codeFor('gul@example.com')

    const tooSoon = await new Client(base).post(`/contact/${id}/resend`)
    assert.equal(tooSoon.status, 429)

    await ageLastSend(id)
    const resent = await new Client(base).post(`/contact/${id}/resend`)
    assert.equal(resent.status, 202)
    const second = await codeFor('gul@example.com', { previous: first })
    assert.ok(second && second !== first, 'a new code was emailed')
    assert.equal((await new Client(base).post(`/contact/${id}/verify`, { code: second })).status, 200)
  })

  test('D4: a signed-in deletion request is verified at once and does not use the one-a-day quota', async () => {
    const hina = await createVerifiedUser({ firstName: 'Hina', surname: 'Signed', email: 'hina@example.com' })
    const sent = await hina.post('/contact', deletion('hina@example.com', { name: 'Hina Signed' }))
    assert.equal(sent.status, 201)
    assert.equal(sent.body.data.verificationRequired, false)
    assert.equal((await stored(sent.body.data.id)).verified, true)
    assert.equal(contactDeliveries.at(-1).verification, 'verified')
    assert.equal((await new Client(base).post(`/contact/${sent.body.data.id}/resend`)).status, 400, 'nothing to resend')

    const general = await hina.post('/contact', { name: 'Hina Signed', email: 'hina@example.com', message: 'And a question' })
    assert.equal(general.status, 201, 'the daily general message is still available')
    assert.equal(contactDeliveries.at(-1).verification, null)
  })

  test('D4: a request for an email with no account sends no code and stays unverified', async () => {
    const sent = await new Client(base).post('/contact', deletion('nobody-here@example.com'))
    assert.equal(sent.status, 201)
    assert.equal(sent.body.data.verificationRequired, true)
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.equal(deliveredCodes.get('nobody-here@example.com:deletion-request'), undefined)
    const request = await stored(sent.body.data.id)
    assert.equal(request.verified, false)
    assert.equal(request.verificationCodeHash, null)
    assert.equal((await new Client(base).post(`/contact/${sent.body.data.id}/verify`, { code: '123456' })).status, 400)
  })

  test('D4: unknown ids and malformed codes are refused', async () => {
    assert.equal((await new Client(base).post('/contact/0123456789abcdef01234567/verify', { code: '123456' })).status, 400)
    assert.equal((await new Client(base).post('/contact/not-an-id/verify', { code: '123456' })).status, 422)
    assert.equal((await new Client(base).post('/contact/0123456789abcdef01234567/verify', { code: '12345' })).status, 422)
    assert.equal((await new Client(base).post('/contact/0123456789abcdef01234567/resend')).status, 400)
  })

  test('D4: the admin inbox shows verified and status, and never the code fields', async () => {
    const list = await admin.get('/admin/messages')
    assert.equal(list.status, 200)
    const requests = list.body.data.filter((m) => m.topic === 'recording-deletion')
    assert.ok(requests.some((m) => m.verified === true))
    assert.ok(requests.some((m) => m.verified === false))
    for (const message of list.body.data) {
      assert.equal(message.status, 'open')
      assert.equal(message.handledBy, null)
      for (const secret of ['verificationCodeHash', 'verificationExpiresAt', 'verificationAttempts', 'verificationSentAt']) {
        assert.equal(secret in message, false, `${secret} must not be returned`)
      }
    }
  })
})

describe('code email limits: S4, fixes after verification', () => {
  const codeEmails = (email) => listCapturedEmails({ to: email, purpose: 'deletion-request' }).length
  /** Waits until `email` has received `count` code emails, then a little longer for any extra. */
  async function settle(email, count) {
    for (let attempt = 0; attempt < 100 && codeEmails(email) < count; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
    return codeEmails(email)
  }

  test('S4: the sixth code for one request is refused and no sixth email is sent', async () => {
    await createVerifiedUser({ firstName: 'Iqra', surname: 'Flood', email: 'iqra@example.com' })
    const { id } = (await new Client(base).post('/contact', deletion('iqra@example.com'))).body.data
    assert.equal(await settle('iqra@example.com', 1), 1)

    for (let send = 2; send <= 5; send += 1) {
      await ageLastSend(id)
      assert.equal((await new Client(base).post(`/contact/${id}/resend`)).status, 202, `resend ${send}`)
      assert.equal(await settle('iqra@example.com', send), send)
    }
    await ageLastSend(id)
    const sixth = await new Client(base).post(`/contact/${id}/resend`)
    assert.equal(sixth.status, 429)
    assert.equal(sixth.body.error.message, 'This request has had too many codes. Send a new request tomorrow.')
    assert.equal(await settle('iqra@example.com', 6), 5, 'no sixth email')
  })

  test('S4: requests from different IPs for the same address stop at five code emails a day', async () => {
    await createVerifiedUser({ firstName: 'Jana', surname: 'Target', email: 'jana@example.com' })
    const emailKey = contactSenderKey('email', 'jana@example.com')
    const answers = []
    for (let n = 1; n <= 7; n += 1) {
      // A fresh IP and device for every request: drop every sender row except the address's.
      await mongoose.models.ContactSenderQuota.deleteMany({ key: { $ne: emailKey } })
      const sent = await new Client(base).post('/contact', deletion('jana@example.com'), { headers: { 'x-device-id': `device-jana-${n}` } })
      answers.push({ status: sent.status, keys: Object.keys(sent.body.data).sort(), verificationRequired: sent.body.data.verificationRequired })
      await settle('jana@example.com', Math.min(n, 5))
    }
    assert.equal(await settle('jana@example.com', 7), 5)
    for (const answer of answers) assert.deepEqual(answer, answers[0], 'the answer never changes at the cap')
    assert.equal(answers[0].status, 201)
  })

  test('S4: two simultaneous resends of one request send one email', async () => {
    await createVerifiedUser({ firstName: 'Kiran', surname: 'Race', email: 'kiran@example.com' })
    const { id } = (await new Client(base).post('/contact', deletion('kiran@example.com'))).body.data
    assert.equal(await settle('kiran@example.com', 1), 1)
    await ageLastSend(id)

    const statuses = (await Promise.all([1, 2].map(() => new Client(base).post(`/contact/${id}/resend`)))).map((r) => r.status)
    assert.deepEqual(statuses.sort(), [202, 429])
    assert.equal(await settle('kiran@example.com', 3), 2, 'the first code plus exactly one resend')
    const stored = await mongoose.models.ContactMessage.findById(id).select('+verificationSendCount')
    assert.equal(stored.verificationSendCount, 2)
  })
})
