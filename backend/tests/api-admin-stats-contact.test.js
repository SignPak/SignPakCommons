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
  const admin = context.admin
  daily = (await admin.post('/categories', { label: 'Daily phrases', tone: 'yellow' })).body.data
  work = (await admin.post('/categories', { label: 'Work', tone: 'blue' })).body.data
  const makeVideo = async (title, categoryId, status = 'published') => {
    const result = await admin.upload('/videos', videoForm({ title, categoryId, status, durationSec: '3' }))
    assert.equal(result.status, 201, JSON.stringify(result.body))
    return result.body.data
  }
  video1 = await makeVideo('First sign', daily.id)
  video2 = await makeVideo('Second sign', daily.id)
  draft = await makeVideo('Secret draft', daily.id, 'draft')
  await makeVideo('Unassigned', '')
  await context.createVerifiedUser({ firstName: 'Eve', surname: 'Hacker', email: 'eve@example.com' })
  const submissionForm = (videoId) => recordingForm({ videoId, trimStart: '0', trimEnd: '2.5', duration: '3', mirrored: 'true' })
  assert.equal((await context.contributor.upload('/submissions', submissionForm(video1.id))).status, 201)
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.SUBMISSION_COOLDOWN_MS || 200) + 30))
  assert.equal((await context.contributor.upload('/submissions', submissionForm(video1.id))).status, 201)
  assert.equal((await context.other.upload('/submissions', submissionForm(video2.id))).status, 201)
  assert.equal((await admin.delete(`/videos/${video2.id}`)).status, 204)
})
describe('admin stats and contact', () => {
  test('stats add up', async () => {
    assert.equal((await contributor.get('/admin/stats')).status, 403)
    const res = await admin.get('/admin/stats?days=7')
    assert.equal(res.status, 200)
    const { totals, activity, byCategory, recent } = res.body.data
    assert.equal(totals.contributors, 3) // sara, omar, eve
    assert.equal(totals.submissions, 3) // sara's two takes on video1 (cooldown test), plus omar's one on video2
    assert.equal(totals.categories, 2)
    assert.equal(totals.videos, 3)
    assert.equal(totals.publishedVideos, 2) // video 1 and the unassigned one; the draft is not counted
    assert.equal(activity.length, 7)
    assert.equal(activity.reduce((sum, d) => sum + d.count, 0), 3)
    assert.equal(activity.at(-1).date, new Date().toISOString().slice(0, 10))
    // Omar's video was deleted earlier, so it counts towards totals and activity but no longer belongs to a category.
    assert.equal(byCategory.find((c) => c.categoryId === daily.id).count, 2) // both of sara's video1 submissions
    assert.equal(byCategory.find((c) => c.categoryId === work.id).count, 0)
    assert.equal(recent.length, 3)
    assert.ok(['Sara Ahmed', 'Omar Khan'].includes(recent[0].contributor.name))
    assert.equal(recent.find((r) => r.video === null)?.category, null) // the deleted video
    assert.equal((await admin.get('/admin/stats?days=1000')).status, 422)
  })

  test('deleting a category unassigns its videos instead of deleting them', async () => {
    assert.equal((await admin.delete(`/categories/${daily.id}`)).status, 204)
    const kept = await admin.get(`/videos/${video1.id}`)
    assert.equal(kept.status, 200)
    assert.equal(kept.body.data.categoryId, null)
    assert.equal((await contributor.get(`/videos/${video1.id}`)).status, 404) // hidden from contributors now
  })

  test('contact delivery requires matching account email, enforces quotas, and blocks abusive devices', async () => {
    const bad = await contributor.post('/contact', { name: '', email: 'nope', message: '' })
    assert.equal(bad.status, 422)
    assert.ok(bad.body.error.fields.email)
    assert.equal((await contributor.post('/contact', { name: 'Sara Ahmed', email: 'sara@example.com', message: 'Provider failure' })).status, 500)
    const sent = await contributor.post('/contact', { name: 'Sara Ahmed', email: 'sara@example.com', message: 'Hello!' })
    assert.equal(sent.status, 201)
    assert.equal(contactDeliveries.length, 1)
    assert.equal(contactDeliveries[0].email, 'sara@example.com')
    assert.equal((await contributor.post('/contact', { name: 'Sara Ahmed', email: 'sara@example.com', message: 'Again today' })).status, 409)

    const mismatchDevice = 'device-contact-email-mismatch'
    assert.equal((await contributor.post('/contact', { name: 'Sara Ahmed', email: 'other@example.com', message: 'Wrong email' }, { headers: { 'x-device-id': mismatchDevice } })).status, 403)
    assert.equal((await new Client(base).get('/health', { headers: { 'x-device-id': mismatchDevice } })).status, 403)

    const today = new Date().toISOString().slice(0, 10)
    await ContactDailyQuota.findByIdAndUpdate(today, { count: 25 }, { upsert: true })
    const cappedDevice = 'device-contact-global-cap'
    assert.equal((await other.post('/contact', { name: 'Omar Khan', email: 'omar@example.com', message: 'Over cap' }, { headers: { 'x-device-id': cappedDevice } })).status, 429)
    assert.equal((await new Client(base).get('/health', { headers: { 'x-device-id': cappedDevice } })).status, 403)

    const anonymousDevice = 'device-contact-anonymous-test'
    assert.equal((await new Client(base).post('/contact', { name: 'Guest', email: 'guest@example.com', message: 'No session' }, { headers: { 'x-device-id': anonymousDevice } })).status, 403)
    assert.equal((await new Client(base).get('/health', { headers: { 'x-device-id': anonymousDevice } })).status, 403)

    const list = await admin.get('/admin/messages')
    assert.equal(list.status, 200)
    assert.ok(list.body.data.some((m) => m.name === 'Sara Ahmed' && m.message === 'Hello!' && m.userId))
    assert.equal((await contributor.get('/admin/messages')).status, 403)
  })

  test('oversized uploads are rejected with 413', async () => {
    const res = await admin.upload('/videos', videoForm({ title: 'Huge' }, { video: webm(6 * 1024 * 1024) }))
    assert.equal(res.status, 413)
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE')
    assert.deepEqual(filesIn('tmp'), [])
  })
})
