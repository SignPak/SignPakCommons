import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { Client, filesIn, jpeg, mp4, recordingForm, videoForm, webm } from './helpers.js'
import { useApiContext } from './apiContext.js'

const getContext = useApiContext()
let base, admin, contributor, other, createVerifiedUser, deliveredCodes, contactDeliveries
let ContactDailyQuota, Submission, SubmissionCooldown, storageService, authService, submissionRepo
let daily, work, video1, video2, draft, submission, eveSession

before(() => {
  const context = getContext()
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
