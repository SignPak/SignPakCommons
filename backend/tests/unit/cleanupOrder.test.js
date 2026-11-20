import assert from 'node:assert/strict'
import test from 'node:test'
import { categoryRepo, replace, storageService, temporaryDirectory, videoRepo, videoService, writeImage, writeVideo } from '../support/videoServiceTestHelpers.js'
import { CONSENT_VERSION } from '../../src/config/constants.js'
import { submissionRepo } from '../../src/repositories/submissionRepo.js'
import { demoVideoRepo } from '../../src/repositories/demoVideoRepo.js'
import { submissionService } from '../../src/services/submissionService.js'
import { demoVideoService } from '../../src/services/demoVideoService.js'
import { logger } from '../../src/utils/logger.js'

/**
 * B1: when an upload fails part-way, the clean-up must never make things worse. Every clean-up
 * step runs on its own; if one fails it is logged and the next still runs; and the caller always
 * gets the ORIGINAL error, not the clean-up's.
 */

const storageFailure = () => Object.assign(new Error('The video could not be stored. Try again later.'), { status: 502, code: 'STORAGE_ERROR' })

test('B1: a failing file removal still releases the submission cooldown and rethrows the original error', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory, 'take.webm', 'webm')
  const databaseDown = new Error('database unavailable')
  const released = []
  t.mock.method(logger, 'error', () => {})

  replace(t, videoRepo, 'findById', async () => ({ _id: 'video-1', title: 'Hello', status: 'published', category: 'category-1' }))
  replace(t, categoryRepo, 'findById', async () => ({ _id: 'category-1', label: 'Daily' }))
  replace(t, submissionRepo, 'claimCooldown', async () => new Date())
  replace(t, submissionRepo, 'countForPair', async () => 0)
  replace(t, storageService, 'archive', async () => ({ driver: 'gdrive-archive', key: 'drive-file-1' }))
  replace(t, submissionRepo, 'create', async () => { throw databaseDown })
  replace(t, storageService, 'remove', async () => { throw storageFailure() })
  replace(t, submissionRepo, 'releaseCooldown', async (user, video) => { released.push([user, video]) })

  await assert.rejects(
    () => submissionService.create(
      { _id: 'user-1', role: 'user', consent: { version: CONSENT_VERSION } },
      { videoId: 'video-1', trimStart: 0, trimEnd: 2, duration: 3, mirrored: false },
      upload,
    ),
    (error) => error === databaseDown,
  )
  assert.deepEqual(released, [['user-1', 'video-1']], 'the cooldown is released even though removing the file failed')
})

test('B1: a failing cooldown release is logged and does not hide the original error', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory, 'take.webm', 'webm')
  const archiveDown = new Error('archive unavailable')
  const errors = t.mock.method(logger, 'error', () => {})

  replace(t, videoRepo, 'findById', async () => ({ _id: 'video-1', title: 'Hello', status: 'published', category: 'category-1' }))
  replace(t, categoryRepo, 'findById', async () => ({ _id: 'category-1', label: 'Daily' }))
  replace(t, submissionRepo, 'claimCooldown', async () => new Date())
  replace(t, submissionRepo, 'countForPair', async () => 0)
  replace(t, storageService, 'archive', async () => { throw archiveDown })
  replace(t, submissionRepo, 'releaseCooldown', async () => { throw new Error('release failed') })

  await assert.rejects(
    () => submissionService.create(
      { _id: 'user-1', role: 'user', consent: { version: CONSENT_VERSION } },
      { videoId: 'video-1', trimStart: 0, trimEnd: 2, duration: 3, mirrored: false },
      upload,
    ),
    (error) => error === archiveDown,
  )
  assert.ok(errors.mock.calls.some((call) => /release failed/.test(String(call.arguments[0]?.err?.message))))
})

test('B1: one failing removal does not stop the others, and video create rethrows the original error', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory)
  const poster = await writeImage(directory, 'poster.jpg')
  const databaseDown = new Error('database unavailable')
  const removed = []
  t.mock.method(logger, 'error', () => {})

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, storageService, 'save', async (file, { fileName }) => ({ driver: 'gdrive', key: fileName }))
  replace(t, videoRepo, 'create', async () => { throw databaseDown })
  replace(t, storageService, 'remove', async (ref) => {
    removed.push(ref.key)
    if (ref.key.endsWith('.mp4')) throw storageFailure()
  })

  await assert.rejects(
    () => videoService.create({ _id: 'admin-1' }, { title: 'Hello', status: 'draft' }, { video: [upload], poster: [poster] }),
    (error) => error === databaseDown,
  )
  assert.deepEqual(removed.sort(), ['Hello (poster).jpg', 'Hello.mp4'], 'the poster is still removed after the video removal failed')
})

test('B1: a failing rollback of the new demo video rethrows the original error', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory)
  const databaseDown = new Error('database unavailable')
  t.mock.method(logger, 'error', () => {})

  replace(t, storageService, 'save', async () => ({ driver: 'gdrive', key: 'new-demo' }))
  replace(t, demoVideoRepo, 'find', async () => null)
  replace(t, demoVideoRepo, 'replace', async () => { throw databaseDown })
  replace(t, storageService, 'remove', async () => { throw storageFailure() })

  await assert.rejects(() => demoVideoService.upload({ title: 'Demo' }, upload), (error) => error === databaseDown)
})

test('B1: a failed removal of the previous demo file keeps the new demo video', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory)
  const removed = []
  t.mock.method(logger, 'error', () => {})
  const saved = { title: 'New demo', videoFile: { driver: 'gdrive', key: 'new-demo' } }

  replace(t, storageService, 'save', async () => saved.videoFile)
  replace(t, demoVideoRepo, 'find', async () => ({ title: 'Old demo', videoFile: { driver: 'gdrive', key: 'old-demo' } }))
  replace(t, demoVideoRepo, 'replace', async () => saved)
  replace(t, storageService, 'remove', async (ref) => {
    removed.push(ref.key)
    throw storageFailure() // Drive hiccup while deleting the OLD file
  })

  // The database already points at the new file, so the upload has succeeded: the old file is
  // just a leftover to log, and the new file must not be rolled back.
  assert.equal(await demoVideoService.upload({ title: 'New demo' }, upload), saved)
  assert.deepEqual(removed, ['old-demo'], 'the new demo file is never deleted')
})
