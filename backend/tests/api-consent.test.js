import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client, recordingForm, videoForm } from './helpers.js'
import { CONSENT_VERSION } from '../src/config/constants.js'
import { useApiContext } from './apiContext.js'

const getContext = useApiContext({ after })
let base, admin, createVerifiedUser, deliveredCodes

before(async () => {
  const context = await getContext()
  ;({ base, admin, createVerifiedUser, deliveredCodes } = context)
})

const signupAndVerify = async (email) => {
  const client = new Client(base)
  const signup = await client.post('/auth/signup', { firstName: 'Lina', surname: 'Raza', email, password: 'password1' })
  assert.equal(signup.status, 201)
  const verified = await client.post('/auth/verify-email', {
    email,
    code: deliveredCodes.get(`${email}:email-verification`),
  })
  assert.equal(verified.status, 200)
  return { client, token: verified.body.data.consentToken }
}

describe('consent notice', () => {
  test('creates the account only after consent and records the acceptance time', async () => {
    const { client, token } = await signupAndVerify('lina@example.com')
    assert.equal((await client.get('/users/me')).status, 401)
    assert.equal((await client.post('/auth/login', { email: 'lina@example.com', password: 'password1' })).status, 401)
    assert.equal((await client.post('/auth/consent', { consentToken: token, accepted: false, version: CONSENT_VERSION })).status, 422)
    assert.equal((await client.post('/auth/consent', { consentToken: token, accepted: true, version: 'old' })).status, 409)

    const before = Date.now()
    const accepted = await client.post('/auth/consent', { consentToken: token, accepted: true, version: CONSENT_VERSION })
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.data.emailVerified, true)
    assert.equal(accepted.body.data.consent.version, CONSENT_VERSION)
    assert.ok(new Date(accepted.body.data.consent.acceptedAt).getTime() >= before - 1000)
    assert.equal((await client.get('/users/me')).status, 200)
    assert.equal((await new Client(base).post('/auth/login', { email: 'lina@example.com', password: 'password1' })).status, 200)
    assert.equal((await client.post('/auth/consent', { consentToken: token, accepted: true, version: CONSENT_VERSION })).status, 400)
  })

  test('declining consent discards the unfinished signup', async () => {
    const { client, token } = await signupAndVerify('mina@example.com')
    assert.equal((await client.post('/auth/decline-consent', { consentToken: token })).status, 204)
    assert.equal((await new Client(base).post('/auth/login', { email: 'mina@example.com', password: 'password1' })).status, 401)
    const retry = await new Client(base).post('/auth/signup', {
      firstName: 'Mina',
      surname: 'Ali',
      email: 'mina@example.com',
      password: 'password1',
    })
    assert.equal(retry.status, 201)
  })

  test('legacy accounts without consent cannot submit until they accept', async () => {
    const user = await createVerifiedUser({ firstName: 'Old', surname: 'Timer', email: 'old@example.com', consent: false })
    const profile = await user.get('/users/me')
    assert.equal(profile.body.data.consent.acceptedAt, null)

    const category = await admin.post('/categories', { label: 'Consent greetings', tone: 'blue' })
    assert.equal(category.status, 201)
    const upload = await admin.upload('/videos', videoForm({
      title: 'Consent hello',
      categoryId: category.body.data.id,
      status: 'published',
      durationSec: '3',
    }))
    assert.equal(upload.status, 201)
    const form = () => recordingForm({
      videoId: upload.body.data.id,
      trimStart: '0',
      trimEnd: '2.5',
      duration: '3',
      mirrored: 'false',
    })

    const blocked = await user.upload('/submissions', form())
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error.code, 'CONSENT_REQUIRED')
    assert.equal((await user.post('/users/me/consent', { accepted: true, version: CONSENT_VERSION })).status, 200)
    assert.equal((await user.upload('/submissions', form())).status, 201)
  })
})
