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
before(async () => {
  const context = getContext()
  const category = (await context.admin.post('/categories', { label: 'Daily phrases', tone: 'yellow' })).body.data
  const video = await context.admin.upload('/videos', videoForm({ title: 'First sign', categoryId: category.id, durationSec: '3' }))
  assert.equal(video.status, 201, JSON.stringify(video.body))
  const submission = await context.other.upload('/submissions', recordingForm({ videoId: video.body.data.id, trimStart: '0', trimEnd: '2.5', duration: '3', mirrored: 'true' }))
  assert.equal(submission.status, 201, JSON.stringify(submission.body))
})
describe('admin user controls and access restrictions', () => {
  test('suspending a user blocks its existing session and login; reactivation restores access', async () => {
    const otherId = (await admin.get('/admin/users')).body.data.find((user) => user.email === 'omar@example.com').id
    const selfId = (await admin.get('/admin/users')).body.data.find((user) => user.email === 'admin@signpak.test').id
    assert.equal((await admin.patch(`/admin/users/${selfId}`, { status: 'suspended' })).status, 403)
    const suspended = await admin.patch(`/admin/users/${otherId}`, { status: 'suspended', reason: 'Repeated abuse' })
    assert.equal(suspended.status, 200)
    assert.equal(suspended.body.data.status, 'suspended')
    assert.equal(suspended.body.data.statusReason, 'Repeated abuse')
    assert.equal((await other.get('/users/me')).status, 401)
    assert.equal((await new Client(base).post('/auth/login', { email: 'omar@example.com', password: 'password1' })).status, 401)
    assert.equal((await admin.patch(`/admin/users/${otherId}`, { status: 'active' })).body.data.status, 'active')
    assert.equal((await other.get('/users/me')).status, 200)
  })

  test('deleting a user removes their submissions, cooldowns, and stored recording', async () => {
    const otherId = (await admin.get('/admin/users')).body.data.find((user) => user.email === 'omar@example.com').id
    const recording = (await Submission.findOne({ user: otherId })).recording
    assert.ok(await SubmissionCooldown.countDocuments({ user: otherId }))
    assert.equal((await admin.delete(`/admin/users/${otherId}`)).status, 204)
    assert.equal(await Submission.countDocuments({ user: otherId }), 0)
    assert.equal(await SubmissionCooldown.countDocuments({ user: otherId }), 0)
    await assert.rejects(() => storageService.describe(recording))
    assert.equal((await other.get('/users/me')).status, 401)
    assert.equal((await admin.get('/admin/users')).body.data.some((user) => user.id === otherId), false)
    assert.equal((await admin.get('/submissions')).body.data.length, 0)
    assert.equal((await admin.delete(`/admin/users/${otherId}`)).status, 404)
  })

  test('device restrictions reject matching IDs, expose only a hint, and can be removed', async () => {
    const deviceId = 'device-test-1234567890'
    const deviceLogin = new Client(base)
    await deviceLogin.post('/auth/login', { email: 'sara@example.com', password: 'password1' }, { headers: { 'x-device-id': deviceId } })
    const sara = (await admin.get('/admin/users')).body.data.find((user) => user.email === 'sara@example.com')
    assert.equal(sara.lastDeviceId, deviceId)
    assert.equal((await deviceLogin.get('/auth/session')).body.data.lastDeviceId, undefined)
    const made = await admin.post('/admin/restrictions', { type: 'device', value: deviceId, reason: 'Abuse' })
    assert.equal(made.status, 201)
    assert.equal(made.body.data.identifierHint, 'device-t...7890')
    assert.equal(made.body.data.identifierHash, undefined)
    const blocked = new Client(base)
    assert.equal((await blocked.get('/videos', { headers: { 'x-device-id': deviceId } })).status, 403)
    const duplicate = await admin.post('/admin/restrictions', { type: 'device', value: deviceId })
    assert.equal(duplicate.status, 409)
    assert.equal((await admin.delete(`/admin/restrictions/${made.body.data.id}`)).status, 204)
    assert.equal((await blocked.get('/videos', { headers: { 'x-device-id': deviceId } })).status, 200)
  })

  test('IP restrictions block API traffic while admin routes remain available for recovery', async () => {
    assert.equal((await admin.post('/admin/restrictions', { type: 'ip', value: 'not-an-ip' })).status, 422)
    const made = await admin.post('/admin/restrictions', { type: 'ip', value: '::ffff:127.0.0.1' })
    assert.equal(made.status, 201)
    assert.equal((await new Client(base).get('/videos')).status, 403)
    assert.equal((await admin.get('/admin/restrictions')).status, 200)
    assert.equal((await admin.delete(`/admin/restrictions/${made.body.data.id}`)).status, 204)
    assert.equal((await new Client(base).get('/videos')).status, 200)
  })
})
