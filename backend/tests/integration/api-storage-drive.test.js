import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { filesIn, jpeg, mp4, recordingForm, uploadDir, videoForm, webm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { createFakeDriveDriver } from '../support/fakeDriveDriver.js'

/**
 * The real app with Google Drive as storage, as in production, using the in-memory Drive
 * stand-in (tests/support/fakeDriveDriver.js). Unlike the local driver, Drive only *reads* the
 * temp file, which is exactly what made C5 a leak.
 */

const getContext = useApiContext({ after })
const primary = createFakeDriveDriver({ name: 'gdrive' })
const archive = createFakeDriveDriver({ name: 'gdrive-archive' })
let context, admin, contributor, other, category, video
let restoreStorage = () => {}
// File-level hook: an after() registered inside before() would run as soon as before() ends.
after(() => restoreStorage())

/** An MP4-family header with the given major brand (and isom/mp42 compatible, as real files do). */
const isoMedia = (major) => Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from(major, 'latin1'), Buffer.alloc(4),
  Buffer.from('isommp42'), Buffer.alloc(3000, 5),
])

const good = () => ({ videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false' })

before(async () => {
  const { routeStorageForTests } = await import('../../src/services/storage/index.js')
  restoreStorage = routeStorageForTests({ primary, archive })
  context = await getContext()
  ;({ admin, contributor, other } = context)
  category = (await admin.post('/categories', { label: 'Daily', tone: 'yellow' })).body.data
  const made = await admin.upload('/videos', videoForm({ title: 'Hello', categoryId: category.id, durationSec: '3' }))
  assert.equal(made.status, 201, JSON.stringify(made.body))
  video = made.body.data
})

describe('storage on Google Drive', () => {
  test('C5: removes the temp file after a Drive upload of a reference video and its poster', async () => {
    const before = primary.files.size
    const res = await admin.upload('/videos', videoForm({ title: 'With poster', categoryId: category.id, durationSec: '3' }, { video: mp4(), poster: jpeg() }))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(primary.files.size, before + 2, 'video and poster are in Drive')
    assert.deepEqual(filesIn('tmp'), [], 'nothing is left in uploads/tmp')
  })

  test('C5: removes the temp file after a Drive upload of a contributor recording', async () => {
    const res = await contributor.upload('/submissions', recordingForm(good()))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(archive.files.size, 1)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('C5: removes the temp file after a Drive upload of the demo video', async () => {
    const form = new FormData()
    form.append('title', 'How it works')
    form.append('video', new Blob([webm()], { type: 'video/webm' }), 'demo.webm')
    const res = await admin.upload('/demo-video', form)
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('B1: when the database write and the Drive clean-up both fail, the original error is returned and the cooldown is released', async () => {
    const originalCreate = context.submissionRepo.create
    try {
      context.submissionRepo.create = async () => { throw new Error('database unavailable') }
      archive.failOn.remove = { sticky: true, error: new Error('Drive unavailable') }

      const failed = await other.upload('/submissions', recordingForm(good()))
      // The real failure (an unexpected database error) reaches the client, not the clean-up's 502.
      assert.equal(failed.status, 500, JSON.stringify(failed.body))
      assert.equal(failed.body.error.code, 'INTERNAL_ERROR')
      assert.deepEqual(filesIn('tmp'), [])
    } finally {
      context.submissionRepo.create = originalCreate
      archive.failOn.remove = null
    }
    // The cooldown was released despite the failed clean-up, so an immediate retry works.
    const retried = await other.upload('/submissions', recordingForm(good()))
    assert.equal(retried.status, 201, JSON.stringify(retried.body))
  })

  test('B1: a failed removal of the previous demo video keeps the new one playable', async () => {
    const first = new FormData()
    first.append('title', 'Old demo')
    first.append('video', new Blob([webm(1000)], { type: 'video/webm' }), 'old.webm')
    assert.equal((await admin.upload('/demo-video', first)).status, 201)

    primary.failOn.remove = new Error('Drive unavailable') // fails the removal of the OLD file once
    const second = new FormData()
    second.append('title', 'New demo')
    second.append('video', new Blob([webm(1500)], { type: 'video/webm' }), 'new.webm')
    const replaced = await admin.upload('/demo-video', second)
    assert.equal(replaced.status, 201, JSON.stringify(replaced.body))

    const file = await admin.get('/demo-video/file', { raw: true })
    assert.equal(file.status, 200)
    assert.equal(file.body.length, 1504, 'the new demo file is served, not deleted')
    assert.equal((await admin.get('/demo-video')).body.data.title, 'New demo')
  })

  test('B6: .m4a and .3gp recordings are rejected with 422 and nothing is stored', async () => {
    const stored = archive.files.size
    for (const [major, name, type] of [['M4A ', 'voice.m4a', 'audio/mp4'], ['3gp4', 'clip.3gp', 'video/3gpp'], ['heic', 'photo.heic', 'video/mp4']]) {
      const form = recordingForm(good(), { file: isoMedia(major), type })
      const res = await contributor.upload('/submissions', form)
      // An audio/* content type is already refused by the upload filter; the rest by the brand check.
      assert.equal(res.status, 422, `${name}: ${JSON.stringify(res.body)}`)
    }
    assert.equal(archive.files.size, stored)
    assert.deepEqual(filesIn('tmp'), [])
  })

  test('C5: old temp files are cleared when storage initializes at startup', async () => {
    const tmp = path.join(uploadDir, 'tmp')
    const stale = path.join(tmp, 'left-over-from-a-crash')
    const fresh = path.join(tmp, 'upload-in-progress')
    await fs.writeFile(stale, 'old bytes')
    await fs.writeFile(fresh, 'new bytes')
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    await fs.utimes(stale, twoHoursAgo, twoHoursAgo)

    await context.storageService.init()

    assert.deepEqual(filesIn('tmp'), [path.join('tmp', 'upload-in-progress')])
    await fs.unlink(fresh)
  })
})
