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
  daily = (await context.admin.post('/categories', { label: 'Daily phrases', copy: 'Everyday.', tone: 'yellow' })).body.data
  work = (await context.admin.post('/categories', { label: 'Work', tone: 'blue' })).body.data
})
describe('videos', () => {
  test('upload needs a real video file', async () => {
    const none = await admin.upload('/videos', videoForm({ title: 'No file' }, { video: null }))
    assert.equal(none.status, 422)
    assert.ok(none.body.error.fields.video)
    const fake = await admin.upload('/videos', videoForm({ title: 'Fake' }, { video: Buffer.from('this is just text, not a video at all') }))
    assert.equal(fake.status, 422)
    assert.match(fake.body.error.fields.video, /MP4, WebM or MOV/)
    const noTitle = await admin.upload('/videos', videoForm({ level: 'Beginner' }))
    assert.equal(noTitle.status, 422)
    assert.ok(noTitle.body.error.fields.title)
    const missingCategory = await admin.upload('/videos', videoForm({ title: 'Ghost cat', categoryId: '64b7f0f0f0f0f0f0f0f0f0f0' }))
    assert.equal(missingCategory.status, 422)
    assert.equal((await contributor.upload('/videos', videoForm({ title: 'Nope' }))).status, 403)
    assert.equal((await new Client(base).upload('/videos', videoForm({ title: 'Nope' }))).status, 401)
    assert.deepEqual(filesIn('videos'), [], 'rejected uploads must not leave files behind')
    assert.deepEqual(filesIn('tmp'), [], 'rejected uploads must not leave temp files behind')
  })

  test('admin uploads with and without a poster; the API hides storage internals', async () => {
    const a = await admin.upload('/videos', videoForm({ title: 'Nice to meet you', categoryId: daily.id, level: 'Beginner', durationSec: '134' }, { poster: jpeg() }))
    assert.equal(a.status, 201, JSON.stringify(a.body))
    video1 = a.body.data
    assert.equal(video1.categoryId, daily.id)
    assert.equal(video1.order, 1)
    assert.equal(video1.durationSec, 134)
    assert.equal(video1.videoUrl, `/api/v1/videos/${video1.id}/file`)
    assert.equal(video1.poster, `/api/v1/videos/${video1.id}/poster`)
    assert.equal(video1.videoFile, undefined)
    assert.equal(video1.size, webm().length)
    const b = await admin.upload('/videos', videoForm({ title: 'A warm introduction', categoryId: daily.id }, { video: mp4() }))
    video2 = b.body.data
    assert.equal(video2.order, 2)
    assert.equal(video2.poster, null)
    assert.equal(video2.status, 'published')
    draft = (await admin.upload('/videos', videoForm({ title: 'Secret draft', categoryId: daily.id, status: 'draft' }))).body.data
    const loose = (await admin.upload('/videos', videoForm({ title: 'Unassigned', categoryId: '' }))).body.data
    assert.equal(loose.categoryId, null)
    const storedVideos = filesIn('videos')
    assert.equal(storedVideos.filter((file) => !file.includes('(poster).')).length, 4)
    assert.equal(storedVideos.filter((file) => file.includes('(poster).')).length, 1, 'the poster is stored alongside its video')
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('visibility: contributors and visitors only see published, categorised videos', async () => {
    const titles = (res) => res.body.data.map((v) => v.title).sort()
    assert.deepEqual(titles(await admin.get('/videos')), ['A warm introduction', 'Nice to meet you', 'Secret draft', 'Unassigned'])
    assert.deepEqual(titles(await contributor.get('/videos')), ['A warm introduction', 'Nice to meet you'])
    assert.deepEqual(titles(await new Client(base).get('/videos')), ['A warm introduction', 'Nice to meet you'])
    assert.equal((await contributor.get(`/videos/${draft.id}`)).status, 404)
    assert.equal((await admin.get(`/videos/${draft.id}`)).status, 200)
  })

  test('published files stream publicly with Range support', async () => {
    const full = await new Client(base).get(`/videos/${video1.id}/file`, { raw: true })
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(full.headers.get('content-type'), 'video/webm')
    assert.deepEqual(full.body, webm())
    const part = await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=10-19' } })
    assert.equal(part.status, 206)
    assert.equal(part.headers.get('content-range'), `bytes 10-19/${webm().length}`)
    assert.deepEqual(part.body, webm().subarray(10, 20))
    const tail = await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=-5' } })
    assert.deepEqual(tail.body, webm().subarray(-5))
    assert.equal((await contributor.get(`/videos/${video1.id}/file`, { raw: true, headers: { range: 'bytes=99999-' } })).status, 416)
    assert.equal((await contributor.get(`/videos/${draft.id}/file`)).status, 404)
    const mp4res = await contributor.get(`/videos/${video2.id}/file`, { raw: true })
    assert.equal(mp4res.headers.get('content-type'), 'video/mp4')
  })

  test('posters are served as images', async () => {
    const res = await new Client(base).get(`/videos/${video1.id}/poster`, { raw: true })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/jpeg')
    assert.equal((await new Client(base).get(`/videos/${video2.id}/poster`)).status, 404)
  })

  test('editing: moving categories appends to the end of that path', async () => {
    const moved = await admin.patch(`/videos/${video2.id}`, { categoryId: work.id })
    assert.equal(moved.body.data.categoryId, work.id)
    assert.equal(moved.body.data.order, 1)
    const back = await admin.patch(`/videos/${video2.id}`, { categoryId: daily.id })
    assert.ok(back.body.data.order > draft.order, 'moved video goes after everything already in the path')
    assert.equal((await admin.patch(`/videos/${video2.id}`, { status: 'archived' })).status, 422)
    assert.equal((await admin.patch(`/videos/${video2.id}`, { categoryId: '64b7f0f0f0f0f0f0f0f0f0f0' })).status, 422)
    const unpublished = await admin.patch(`/videos/${draft.id}`, { title: 'Still a draft' })
    assert.equal(unpublished.body.data.title, 'Still a draft')
    assert.equal((await contributor.patch(`/videos/${video2.id}`, { title: 'hax' })).status, 403)
  })
})
