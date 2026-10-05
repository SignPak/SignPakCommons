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

describe('demo video', () => {
  test('admins can upload, replace, and delete the public demo video', async () => {
    const visitor = new Client(base)
    assert.equal((await visitor.get('/demo-video')).body.data, null)
    assert.equal((await contributor.upload('/demo-video', videoForm({ title: 'Not allowed' }))).status, 403)

    const first = await admin.upload('/demo-video', videoForm({ title: 'How to sign', durationSec: '8' }))
    assert.equal(first.status, 201, JSON.stringify(first.body))
    assert.equal(first.body.data.title, 'How to sign')
    assert.equal(first.body.data.videoUrl, '/api/v1/demo-video/file')
    const firstFile = await visitor.get('/demo-video/file', { raw: true })
    assert.equal(firstFile.status, 200)
    assert.deepEqual(firstFile.body, webm())
    assert.equal((await visitor.get('/videos')).body.data.some((video) => video.title === 'How to sign'), false)

    const replacement = await admin.upload('/demo-video', videoForm({ title: 'A new walkthrough' }, { video: mp4() }))
    assert.equal(replacement.status, 201)
    assert.equal(replacement.body.data.title, 'A new walkthrough')
    assert.equal(filesIn('demo').length, 1)
    const replacementFile = await visitor.get('/demo-video/file', { raw: true })
    assert.equal(replacementFile.headers.get('content-type'), 'video/mp4')
    assert.deepEqual(replacementFile.body, mp4())

    assert.equal((await admin.delete('/demo-video')).status, 204)
    assert.equal((await visitor.get('/demo-video')).body.data, null)
    assert.equal((await visitor.get('/demo-video/file')).status, 404)
    assert.deepEqual(filesIn('demo'), [])
  })
})
