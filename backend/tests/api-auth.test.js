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

describe('auth', () => {
  test('signup validates every field', async () => {
    const res = await new Client(base).post('/auth/signup', {})
    assert.equal(res.status, 422)
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    for (const field of ['firstName', 'surname', 'email', 'password']) assert.ok(res.body.error.fields[field], `missing error for ${field}`)
    const mismatch = await new Client(base).post('/auth/signup', { ...contributorData, email: 'x@example.com', confirmPassword: 'different' })
    assert.equal(mismatch.body.error.fields.confirmPassword, 'Passwords do not match.')
    const short = await new Client(base).post('/auth/signup', { ...contributorData, email: 'x@example.com', password: 'short', confirmPassword: undefined })
    assert.equal(short.body.error.fields.password, 'Use at least 8 characters.')
  })

  test('signup sets an httpOnly cookie and never leaks the hash or accepts a role', async () => {
    const c = new Client(base)
    eveSession = c
    const res = await c.post('/auth/signup', { firstName: 'Eve', surname: 'Hacker', email: 'eve@example.com', password: 'password1', role: 'admin' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.email, 'eve@example.com')
    assert.equal(res.body.data.verificationEmailSent, true)
    assert.equal(res.setCookie.length, 0)
    assert.equal((await c.post('/auth/login', { email: 'eve@example.com', password: 'password1' })).status, 401)
    assert.equal((await c.post('/auth/verify-email', { email: 'eve@example.com', code: '000000' })).status, 400)
    const verified = await c.post('/auth/verify-email', { email: 'eve@example.com', code: deliveredCodes.get('eve@example.com:email-verification') })
    assert.equal(verified.status, 200)
    assert.equal(verified.body.data.role, 'user')
    assert.equal(verified.body.data.emailVerified, true)
    assert.equal(res.body.data.passwordHash, undefined)
    assert.match(verified.setCookie[0], /HttpOnly/i)
    assert.match(verified.setCookie[0], /SameSite=Lax/i)
    assert.equal((await c.get('/admin/stats')).status, 403)
  })

  test('password reset codes are one-time and replace the old password', async () => {
    const resetRequested = await new Client(base).post('/auth/forgot-password', { email: 'eve@example.com' })
    const unknownRequested = await new Client(base).post('/auth/forgot-password', { email: 'nobody@example.com' })
    assert.equal(resetRequested.status, 200)
    assert.deepEqual(resetRequested.body, unknownRequested.body)
    const code = deliveredCodes.get('eve@example.com:password-reset')
    const wrong = await new Client(base).post('/auth/reset-password', { email: 'eve@example.com', code: '000000', password: 'password2', confirmPassword: 'password2' })
    assert.equal(wrong.status, 400)
    const reset = await new Client(base).post('/auth/reset-password', { email: 'eve@example.com', code, password: 'password2', confirmPassword: 'password2' })
    assert.equal(reset.status, 200)
    assert.equal((await new Client(base).post('/auth/login', { email: 'eve@example.com', password: 'password1' })).status, 401)
    assert.equal((await new Client(base).post('/auth/login', { email: 'eve@example.com', password: 'password2' })).status, 200)
    assert.equal((await eveSession.get('/users/me')).status, 401)
    const reused = await new Client(base).post('/auth/reset-password', { email: 'eve@example.com', code, password: 'password3', confirmPassword: 'password3' })
    assert.equal(reused.status, 400)
  })

  test('duplicate emails conflict, case-insensitively', async () => {
    const res = await new Client(base).post('/auth/signup', { ...contributorData, email: 'SARA@example.com' })
    assert.equal(res.status, 409)
    assert.ok(res.body.error.fields.email)
  })

  test('login: wrong password and unknown email give the same answer', async () => {
    const wrong = await new Client(base).post('/auth/login', { email: 'sara@example.com', password: 'nope-nope' })
    const unknown = await new Client(base).post('/auth/login', { email: 'ghost@example.com', password: 'nope-nope' })
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(wrong.body.error.message, unknown.body.error.message)
  })

  test('session, logout and tampered cookies', async () => {
    const c = new Client(base)
    assert.equal((await c.get('/auth/session')).body.data, null)
    assert.equal((await c.post('/auth/login', { email: 'SARA@example.com', password: 'password1' })).status, 200)
    assert.equal((await c.get('/auth/session')).body.data.firstName, 'Sara')
    assert.equal((await c.post('/auth/logout')).status, 204)
    assert.equal((await c.get('/auth/session')).body.data, null)
    c.cookies.set('signpak_token', 'not.a.jwt')
    assert.equal((await c.get('/users/me')).status, 401)
  })

  test('the env admin exists once, has the admin role, and re-running is harmless', async () => {
    await authService.ensureAdminFromEnv()
    const users = (await admin.get('/admin/users')).body.data
    assert.equal(users.filter((u) => u.email === 'admin@signpak.test').length, 1)
    assert.equal(users.find((u) => u.email === 'admin@signpak.test').role, 'admin')
  })

  test('admin-only routes reject contributors and visitors', async () => {
    assert.equal((await contributor.get('/admin/users')).status, 403)
    assert.equal((await new Client(base).get('/admin/users')).status, 401)
  })
})
