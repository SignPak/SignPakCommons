import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { categoryRepo, replace, storageService, temporaryDirectory, videoRepo, videoService, writeImage, writeVideo } from './videoServiceTestHelpers.js'
test('video create names video and poster from title and category safely', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory)
  const posterUpload = await writeImage(directory, 'poster.jpeg')
  const saves = []
  const categoryId = 'category-1'
  const category = { _id: categoryId, label: '  Travel / Outdoors  ' }

  replace(t, categoryRepo, 'findById', async () => category)
  replace(t, videoRepo, 'maxOrder', async () => 4)
  replace(t, videoRepo, 'create', async (data) => data)
  replace(t, storageService, 'save', async (file, options) => {
    const ref = { driver: 'local', key: `stored-${saves.length}`, ...file, ...options }
    saves.push({ file, options, ref })
    return ref
  })

  const result = await videoService.create(
    { _id: 'admin-1' },
    { title: '  A: Trip / Under the Stars? ', categoryId, status: 'published', durationSec: 30 },
    { video: [upload], poster: [posterUpload] },
  )

  assert.deepEqual(saves.map(({ options }) => options), [
    { folder: 'videos/Travel Outdoors', fileName: 'A Trip Under the Stars.mp4' },
    { folder: 'videos/Travel Outdoors', fileName: 'A Trip Under the Stars (poster).jpg' },
  ])
  assert.equal(result.order, 5)
  assert.equal(result.videoFile, saves[0].ref)
  assert.equal(result.posterFile, saves[1].ref)
})

test('video create uses Unassigned and Untitled fallbacks when optional labels are absent', async (t) => {
  const directory = await temporaryDirectory(t)
  const upload = await writeVideo(directory)
  const saves = []

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, videoRepo, 'create', async (data) => data)
  replace(t, storageService, 'save', async (_file, options) => {
    saves.push(options)
    return { key: 'stored-video' }
  })

  const result = await videoService.create(
    { _id: 'admin-1' },
    { title: '   ', status: 'draft', durationSec: 0 },
    { video: [upload] },
  )

  assert.deepEqual(saves, [{ folder: 'videos/Unassigned', fileName: 'Untitled.mp4' }])
  assert.equal(result.order, 1)
  assert.equal(result.posterFile, null)
})

test('video create selects detected video and image extensions', async (t) => {
  const directory = await temporaryDirectory(t)
  const cases = [
    { videoType: 'webm', videoExt: '.webm', imageType: 'png', imageExt: '.png' },
    { videoType: 'mov', videoExt: '.mov', imageType: 'webp', imageExt: '.webp' },
  ]

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, videoRepo, 'create', async (data) => data)
  let currentSaves
  replace(t, storageService, 'save', async (_file, options) => {
    currentSaves.push(options.fileName)
    return { key: `${currentSaves.length}` }
  })

  for (const [index, item] of cases.entries()) {
    const upload = await writeVideo(directory, `video-${index}.bin`, item.videoType)
    const poster = await writeImage(directory, `poster-${index}.bin`, item.imageType)
    const saves = []
    currentSaves = saves

    const result = await videoService.create(
      { _id: 'admin-1' },
      { title: `Format ${index}`, status: 'draft', durationSec: 1 },
      { video: [upload], poster: [poster] },
    )

    assert.deepEqual(saves, [`Format ${index}${item.videoExt}`, `Format ${index} (poster)${item.imageExt}`])
    assert.equal(result.posterFile.key, '2')
  }
})

test('video create rejects a missing upload, unsupported content, and invalid categories before storage', async (t) => {
  const directory = await temporaryDirectory(t)
  const unsupported = path.join(directory, 'not-a-video')
  await fs.writeFile(unsupported, 'not a video')
  let saveCount = 0

  replace(t, storageService, 'save', async () => { saveCount += 1 })
  replace(t, categoryRepo, 'findById', async () => null)

  await assert.rejects(
    videoService.create({}, {}, {}),
    (error) => error.code === 'VALIDATION_ERROR' && error.fields.video === 'Choose a video to upload.',
  )
  await assert.rejects(
    videoService.create({}, {}, { video: [{ path: unsupported }] }),
    (error) => error.code === 'VALIDATION_ERROR' && error.fields.video.includes('does not look like'),
  )
  await assert.rejects(
    videoService.create(
      {},
      { title: 'Video', categoryId: 'missing' },
      { video: [await writeVideo(directory)] },
    ),
    (error) => error.code === 'VALIDATION_ERROR' && error.fields.categoryId === 'That category does not exist.',
  )
  assert.equal(saveCount, 0)
})

test('video create rejects oversized or unsupported posters before storage', async (t) => {
  const directory = await temporaryDirectory(t)
  let saveCount = 0
  replace(t, storageService, 'save', async () => { saveCount += 1 })
  replace(t, categoryRepo, 'findById', async () => null)

  const video = await writeVideo(directory)
  const image = await writeImage(directory, 'poster.png', 'png')
  await assert.rejects(
    videoService.create({}, {}, { video: [video], poster: [{ ...image, size: 2 * 1024 * 1024 + 1 }] }),
    (error) => error.code === 'VALIDATION_ERROR' && error.fields.poster.includes('under 2 MB'),
  )

  const invalidPosterPath = path.join(directory, 'invalid-poster')
  await fs.writeFile(invalidPosterPath, 'not an image')
  await assert.rejects(
    videoService.create(
      {},
      {},
      { video: [video], poster: [{ path: invalidPosterPath, size: 8 }] },
    ),
    (error) => error.code === 'VALIDATION_ERROR' && error.fields.poster.includes('must be a JPEG'),
  )
  assert.equal(saveCount, 0)
})

test('video create accepts a poster exactly at the size limit', async (t) => {
  const directory = await temporaryDirectory(t)
  const video = await writeVideo(directory)
  const poster = await writeImage(directory, 'poster.jpeg')
  poster.size = 2 * 1024 * 1024

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, videoRepo, 'create', async (data) => data)
  replace(t, storageService, 'save', async (_file, options) => ({ key: options.fileName }))

  const result = await videoService.create(
    { _id: 'admin-1' },
    { title: 'At limit', status: 'draft', durationSec: 1 },
    { video: [video], poster: [poster] },
  )

  assert.equal(result.posterFile.key, 'At limit (poster).jpg')
})

test('video create surfaces filesystem errors instead of reporting invalid video content', async (t) => {
  let saveCount = 0
  replace(t, storageService, 'save', async () => { saveCount += 1 })
  const missingPath = path.join(os.tmpdir(), `missing-${Date.now()}.mp4`)

  await assert.rejects(
    videoService.create({}, {}, { video: [{ path: missingPath }] }),
    { code: 'ENOENT' },
  )
  assert.equal(saveCount, 0)
})

test('video create removes already stored files when poster storage fails', async (t) => {
  const directory = await temporaryDirectory(t)
  const video = await writeVideo(directory)
  const poster = await writeImage(directory, 'poster.jpeg')
  const storedVideo = { driver: 'local', key: 'video-key' }
  const removed = []
  let saveCount = 0
  const failure = new Error('poster upload failed')

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, storageService, 'save', async () => {
    saveCount += 1
    if (saveCount === 2) throw failure
    return storedVideo
  })
  replace(t, storageService, 'remove', async (ref) => { removed.push(ref) })

  await assert.rejects(
    videoService.create(
      { _id: 'admin-1' },
      { title: 'Video', status: 'draft', durationSec: 1 },
      { video: [video], poster: [poster] },
    ),
    (error) => error === failure,
  )
  assert.deepEqual(removed, [storedVideo])
})

test('video create removes video and poster if the database write fails', async (t) => {
  const directory = await temporaryDirectory(t)
  const video = await writeVideo(directory)
  const poster = await writeImage(directory, 'poster.jpeg')
  const stored = [{ key: 'video-key' }, { key: 'poster-key' }]
  const removed = []
  let saveCount = 0
  const failure = new Error('database write failed')

  replace(t, categoryRepo, 'findById', async () => null)
  replace(t, storageService, 'save', async () => stored[saveCount++])
  replace(t, storageService, 'remove', async (ref) => { removed.push(ref) })
  replace(t, videoRepo, 'create', async () => { throw failure })

  await assert.rejects(
    videoService.create(
      { _id: 'admin-1' },
      { title: 'Video', status: 'draft', durationSec: 1 },
      { video: [video], poster: [poster] },
    ),
    (error) => error === failure,
  )
  assert.deepEqual(removed, stored)
})
