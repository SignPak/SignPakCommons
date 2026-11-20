import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client, filesIn, jpeg, mp4, recordingForm, videoForm, webm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

const getContext = useApiContext({ after })
let base, admin, contributor, other, createVerifiedUser, deliveredCodes, contactDeliveries
let ContactDailyQuota, Submission, SubmissionCooldown, storageService, authService, submissionRepo
let daily, work, video1, video2, draft, submission, eveSession

before(async () => {
  const context = await getContext()
  ;({ base, admin, contributor, other, createVerifiedUser, deliveredCodes, contactDeliveries, ContactDailyQuota, Submission, SubmissionCooldown, storageService, authService, submissionRepo } = context)
})

describe('basics', () => {
  test('root advertises the API and favicon is ignored', async () => {
    const origin = new URL(base).origin
    const root = await new Client(origin).get('/')
    assert.equal(root.status, 200)
    assert.equal(root.body.data.api, '/api/v1')
    assert.equal(root.body.data.docs, '/docs')
    assert.equal((await new Client(origin).get('/favicon.ico')).status, 204)
    assert.equal((await new Client(origin).get('/docs')).status, 200)
    assert.equal((await new Client(origin).get('/api-docs')).status, 200)
    assert.equal((await new Client(origin).get('/docs.json')).body.openapi, '3.0.3')
    assert.equal((await new Client(origin).get('/api-docs.json')).body.openapi, '3.0.3')
  })

  test('health check reports the database', async () => {
    const res = await new Client(base).get('/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.database, 'connected')
  })

  test('C1: health reports database and storage status', async () => {
    const res = await new Client(base).get('/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.data.status, 'ok')
    assert.equal(res.body.data.database, 'connected')
    assert.equal(res.body.data.storage, true)
    // Public endpoint: booleans and counters only.
    assert.deepEqual(Object.keys(res.body.data).sort(), ['database', 'status', 'storage', 'uptime'])
  })

  test('S3: without TRUST_PROXY a forged X-Forwarded-For is ignored', async () => {
    const forged = '203.0.113.9'
    const made = await admin.post('/admin/restrictions', { type: 'ip', value: forged, reason: 'forged header test' })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    try {
      // Not behind a trusted proxy, so the header is just client input and must not decide req.ip.
      const res = await new Client(base).get('/health', { headers: { 'x-forwarded-for': forged } })
      assert.equal(res.status, 200)
    } finally {
      assert.equal((await admin.delete(`/admin/restrictions/${made.body.data.id}`)).status, 204)
    }
  })

  test('C4: the session cookie is host-only, HttpOnly and SameSite=Lax', async () => {
    const login = await new Client(base).post('/auth/login', { email: 'omar@example.com', password: 'password1' })
    assert.equal(login.status, 200)
    const cookie = login.setCookie.find((line) => line.startsWith('signpak_token='))
    assert.ok(cookie, 'login must set the session cookie')
    const attributes = cookie.split(';').slice(1).map((part) => part.trim().toLowerCase())
    assert.ok(attributes.includes('httponly'))
    assert.ok(attributes.includes('samesite=lax'))
    assert.ok(attributes.includes('path=/'))
    // No Domain attribute: the cookie belongs to api.commons.signpak.tech alone (D2), and same-site
    // requests from commons.signpak.tech still carry it.
    assert.ok(!attributes.some((part) => part.startsWith('domain=')), cookie)
  })

  test('public landing stats return aggregate counts without authentication', async () => {
    const client = new Client(base)
    const response = await client.get('/public/stats')
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(response.body.data).sort(), ['categories', 'contributors', 'publishedVideos'])
    for (const value of Object.values(response.body.data)) {
      assert.ok(Number.isInteger(value) && value >= 0)
    }
    assert.equal(response.body.data.categories, (await client.get('/categories')).body.data.length)
    assert.equal(response.body.data.publishedVideos, (await client.get('/videos')).body.data.length)
    assert.ok(response.body.data.contributors >= 2)
  })

  test('unknown routes and bad JSON use the error shape', async () => {
    const c = new Client(base)
    const missing = await c.get('/nope')
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.code, 'NOT_FOUND')
    const bad = await c.request('POST', '/auth/login', { headers: { 'content-type': 'application/json' }, form: '{oops' })
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error.code, 'BAD_REQUEST')
  })

  test('cross-origin writes are refused, allowed origin passes', async () => {
    const c = new Client(base)
    const evil = await c.request('POST', '/auth/logout', { headers: { origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    const fine = await c.request('POST', '/auth/logout', { headers: { origin: 'http://localhost:5173' } })
    assert.equal(fine.status, 204)
  })
})
