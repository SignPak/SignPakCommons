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
})
describe('submissions and the cooldown rule', () => {
  const good = () => ({ videoId: video1.id, trimStart: '0', trimEnd: '2.5', duration: '3', mirrored: 'true' })

  test('archive and database failures release cooldown and remove any archived file', async () => {
    const originalArchive = storageService.archive
    const originalCreate = submissionRepo.create
    const otherId = (await admin.get('/admin/users')).body.data.find((user) => user.email === 'omar@example.com').id
    const cooldownFilter = { user: otherId, video: video1.id }
    let failedRecording
    try {
      storageService.archive = async () => { throw new Error('archive unavailable') }
      const archiveFailure = await other.upload('/submissions', recordingForm(good()))
      assert.equal(archiveFailure.status, 500)
      assert.equal(await SubmissionCooldown.countDocuments(cooldownFilter), 0)

      storageService.archive = originalArchive
      submissionRepo.create = async (data) => {
        failedRecording = data.recording
        throw new Error('database unavailable')
      }
      const databaseFailure = await other.upload('/submissions', recordingForm(good()))
      assert.equal(databaseFailure.status, 500)
      assert.equal(await SubmissionCooldown.countDocuments(cooldownFilter), 0)
      await assert.rejects(() => storageService.describe(failedRecording))
      assert.deepEqual(filesIn('tmp'), [])
    } finally {
      storageService.archive = originalArchive
      submissionRepo.create = originalCreate
    }
  })

  test('input is checked before anything is stored', async () => {
    const before = filesIn('recordings').length
    assert.equal((await new Client(base).upload('/submissions', recordingForm(good()))).status, 401)
    assert.equal((await contributor.upload('/submissions', recordingForm(good(), { file: null }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm(good(), { file: Buffer.from('plain text pretending to be video') }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), trimStart: '2', trimEnd: '1' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), trimEnd: '30' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), videoId: 'nope' }))).status, 422)
    assert.equal((await contributor.upload('/submissions', recordingForm({ ...good(), videoId: draft.id }))).status, 404)
    assert.equal(filesIn('recordings').length, before)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('a valid submission is stored and listed', async () => {
    const res = await contributor.upload('/submissions', recordingForm(good()))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    submission = res.body.data
    assert.equal(submission.videoId, video1.id)
    assert.equal(submission.mirrored, true)
    assert.equal(submission.trimEnd, 2.5)
    assert.equal(submission.recording, undefined)
    assert.equal(filesIn('commons').length, 1)
    const mine = await contributor.get('/submissions')
    assert.equal(mine.body.data.length, 1)
    assert.equal((await other.get('/submissions')).body.data.length, 0)
    assert.equal((await admin.get('/submissions')).body.data.length, 1)
  })

  test('COOLDOWN: a second submission for the same video, too soon, is refused and stores nothing', async () => {
    const again = await contributor.upload('/submissions', recordingForm(good(), { file: mp4() }))
    assert.equal(again.status, 409)
    assert.match(again.body.error.message, /wait \d+s/i)
    assert.equal(filesIn('commons').length, 1)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('COOLDOWN: concurrent double-submits for the same video produce exactly one submission', async () => {
    const results = await Promise.all([1, 2, 3].map(() => other.upload('/submissions', recordingForm({ ...good(), videoId: video2.id }))))
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409])
    assert.equal(filesIn('commons').length, 2, 'losing uploads must not leave orphaned archive folders')
    assert.equal((await other.get('/submissions')).body.data.length, 1)
  })

  test('COOLDOWN: once it elapses, the same video can be submitted again, as a new, separate recording', async () => {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.SUBMISSION_COOLDOWN_MS) + 20))
    const res = await contributor.upload('/submissions', recordingForm(good(), { file: mp4() }))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.notEqual(res.body.data.id, submission.id)
    const mine = await contributor.get('/submissions')
    assert.equal(mine.body.data.length, 2, 'both recordings for this video are kept, not merged or replaced')
  })

  test('a submission can never be edited, deleted, or read once archived', async () => {
    assert.equal((await contributor.patch(`/submissions/${submission.id}`, { trimEnd: 1 })).status, 404)
    assert.equal((await contributor.delete(`/submissions/${submission.id}`)).status, 404)
    assert.equal((await contributor.get(`/submissions/${submission.id}/recording`)).status, 404)
    assert.equal((await admin.get(`/submissions/${submission.id}/recording`)).status, 404)
  })

  test('deleting a base video keeps contributors\' submissions on record', async () => {
    const before = filesIn('videos').length
    assert.equal((await admin.delete(`/videos/${video2.id}`)).status, 204)
    assert.equal(filesIn('videos').length, before - 1, 'the base video file is removed from storage')
    assert.equal((await admin.get(`/videos/${video2.id}`)).status, 404)
    assert.equal((await other.get('/submissions')).body.data.length, 1)
  })
})
