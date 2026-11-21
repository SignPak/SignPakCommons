import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { performance } from 'node:perf_hooks'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * D4: the deletion-request flow must not tell a visitor whether an email has an account.
 * Send, verify and resend are compared for an existing and an unknown email: same status, same
 * body shape and message, and response times in the same band (the code is emailed after the
 * response, so neither path waits on the mail driver).
 */

const getContext = useApiContext({ after })
let base, createVerifiedUser, mongoose

const deletion = (email) => ({ topic: 'recording-deletion', name: 'Visitor', email, message: 'Please delete my data.' })
const shape = (response) => ({
  status: response.status,
  keys: Object.keys(response.body.data ?? response.body.error ?? {}).sort(),
  message: response.body.error?.message ?? response.body.data?.message,
})
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function timed(run) {
  const started = performance.now()
  const response = await run()
  return { response, ms: performance.now() - started }
}

before(async () => {
  ;({ base, createVerifiedUser, mongoose } = await getContext())
  await createVerifiedUser({ firstName: 'Real', surname: 'Person', email: 'real@example.com' })
})
beforeEach(() => mongoose.models.ContactSenderQuota.deleteMany({}))

describe('security: deletion-request verification (D4)', () => {
  test('D4: sending a request answers the same, in shape and time, with and without an account', async () => {
    const timings = { real: [], unknown: [] }
    let real, unknown
    for (let round = 0; round < 6; round += 1) {
      await mongoose.models.ContactSenderQuota.deleteMany({})
      const a = await timed(() => new Client(base).post('/contact', deletion('real@example.com')))
      const b = await timed(() => new Client(base).post('/contact', deletion(`unknown-${round}@example.com`)))
      timings.real.push(a.ms)
      timings.unknown.push(b.ms)
      real = a.response
      unknown = b.response
    }
    assert.deepEqual(shape(real), shape(unknown))
    assert.equal(real.body.data.verificationRequired, unknown.body.data.verificationRequired)
    const gap = Math.abs(median(timings.real) - median(timings.unknown))
    assert.ok(gap < 100, `median response times differ by ${gap.toFixed(1)} ms`)
  })

  test('D4: a wrong code and a resend answer the same with and without an account', async () => {
    const real = (await new Client(base).post('/contact', deletion('real@example.com'))).body.data.id
    const unknown = (await new Client(base).post('/contact', deletion('unknown-verify@example.com'))).body.data.id
    const missing = '0123456789abcdef01234567'

    const wrong = await Promise.all([real, unknown, missing].map((id) => new Client(base).post(`/contact/${id}/verify`, { code: '000000' })))
    assert.deepEqual(shape(wrong[0]), shape(wrong[1]))
    assert.deepEqual(shape(wrong[0]), shape(wrong[2]), 'an id that does not exist looks the same too')

    const tooSoon = await Promise.all([real, unknown].map((id) => new Client(base).post(`/contact/${id}/resend`)))
    assert.deepEqual(shape(tooSoon[0]), shape(tooSoon[1]))
    assert.equal(tooSoon[0].status, 429)

    const aged = new Date(Date.now() - 61_000)
    await mongoose.models.ContactMessage.updateMany({ _id: { $in: [real, unknown] } }, { $set: { verificationSentAt: aged } })
    const resent = await Promise.all([real, unknown].map((id) => new Client(base).post(`/contact/${id}/resend`)))
    assert.deepEqual(shape(resent[0]), shape(resent[1]))
    assert.equal(resent[0].status, 202)
  })

  test('D4: a NoSQL operator in place of the code is rejected as invalid input', async () => {
    const id = (await new Client(base).post('/contact', deletion('real@example.com'))).body.data.id
    for (const code of [{ $gt: '' }, { $ne: null }, ['123456']]) {
      const response = await new Client(base).post(`/contact/${id}/verify`, { code })
      assert.equal(response.status, 422, JSON.stringify(code))
      assert.equal(response.body.error.code, 'VALIDATION_ERROR')
    }
    const stored = await mongoose.models.ContactMessage.findById(id)
    assert.equal(stored.verified, false)
  })

  test('D4: the code routes are rate limited separately from the contact form', async () => {
    const { default: router } = await import('../../src/routes/contactRoutes.js')
    for (const path of ['/:id/verify', '/:id/resend']) {
      const layer = router.stack.find((entry) => entry.route?.path === path)
      assert.ok(layer, `${path} is registered`)
      const names = layer.route.stack.map((entry) => entry.handle)
      const { contactCodeLimiter } = await import('../../src/middlewares/rateLimiter.js')
      assert.equal(names[0], contactCodeLimiter, `${path} starts with contactCodeLimiter`)
    }
  })
})
