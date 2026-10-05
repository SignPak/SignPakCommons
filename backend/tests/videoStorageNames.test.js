import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalDriver } from '../src/services/storage/localDriver.js'
import { safeName } from '../src/utils/files.js'

process.env.NODE_ENV = 'test'
process.env.STORAGE_DRIVER = 'local'
process.env.ARCHIVE_STORAGE_DRIVER = 'local'
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `signpak-storage-test-${process.pid}`)
process.env.MONGODB_URI = 'mongodb://127.0.0.1/signpak-test'
process.env.JWT_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
process.env.ADMIN_EMAIL = 'admin@example.com'
process.env.ADMIN_PASSWORD = 'test-password-123'

const [{ videoService }, { categoryRepo }, { videoRepo }, { storageService }] = await Promise.all([
  import('../src/services/videoService.js'),
  import('../src/repositories/categoryRepo.js'),
  import('../src/repositories/videoRepo.js'),
  import('../src/services/storage/index.js'),
])

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'signpak-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

function replace(t, object, property, value) {
  const original = object[property]
  object[property] = value
  t.after(() => { object[property] = original })
}

async function writeVideo(directory, name = 'upload.mp4', type = 'mp4') {
  const filePath = path.join(directory, name)
  const brand = type === 'mov' ? 'qt  ' : 'isom'
  const header = type === 'webm'
    ? Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
    : Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('ftyp'), Buffer.from(brand)])
  await fs.writeFile(filePath, header)
  return { path: filePath, originalname: name, size: header.length }
}

async function writeImage(directory, name, type = 'jpeg') {
  const filePath = path.join(directory, name)
  const image = {
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
    webp: Buffer.from('RIFF0000WEBP'),
  }[type]
  await fs.writeFile(filePath, image)
  return { path: filePath, originalname: name, size: image.length }
}

test('safeName uses its fallback for nullish and blank values', () => {
  assert.equal(safeName(null), 'Untitled')
  assert.equal(safeName(undefined), 'Untitled')
  assert.equal(safeName(' \t\n '), 'Untitled')
  assert.equal(safeName('\\/:*?"<>|'), 'Untitled')
  assert.equal(safeName('', 'Unnamed category'), 'Unnamed category')
})

test('safeName replaces reserved path characters and collapses whitespace', () => {
  assert.equal(safeName('  Summer\\Travel: Sea / Sky*? "<>|  '), 'Summer Travel Sea Sky')
  assert.equal(safeName(0), '0')
  assert.equal(safeName(false), 'false')
})

test('safeName caps its output at 100 characters', () => {
  assert.equal(safeName('x'.repeat(120)), 'x'.repeat(100))
})

test('local driver stores named files in folders and appends suffixes on collisions', async (t) => {
  const directory = await temporaryDirectory(t)
  const root = path.join(directory, 'storage')
  const driver = createLocalDriver(root)
  await driver.init()

  const keys = []
  for (let index = 0; index < 3; index += 1) {
    const tempPath = path.join(directory, `video-${index}.tmp`)
    await fs.writeFile(tempPath, `video ${index}`)
    const { key } = await driver.save({
      tempPath,
      folder: 'videos/Travel',
      fileName: 'My video.mp4',
      ext: '.mp4',
    })
    keys.push(key)
  }

  assert.deepEqual(keys, [
    'videos/Travel/My video.mp4',
    'videos/Travel/My video (2).mp4',
    'videos/Travel/My video (3).mp4',
  ])
  assert.deepEqual(await Promise.all(keys.map(async (key) => {
    const filePath = path.join(root, ...key.split('/'))
    return fs.readFile(filePath, 'utf8')
  })), ['video 0', 'video 1', 'video 2'])
})

test('local driver handles named files without an extension and dotfiles', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createLocalDriver(path.join(directory, 'storage'))
  await driver.init()

  const save = async (fileName, suffix) => {
    const tempPath = path.join(directory, `${suffix}.tmp`)
    await fs.writeFile(tempPath, suffix)
    return (await driver.save({ tempPath, folder: 'videos', fileName })).key
  }

  assert.equal(await save('Untitled', 'first'), 'videos/Untitled')
  assert.equal(await save('Untitled', 'second'), 'videos/Untitled (2)')
  assert.equal(await save('.hidden', 'hidden-first'), 'videos/.hidden')
  assert.equal(await save('.hidden', 'hidden-second'), 'videos/.hidden (2)')
})

test('local driver generates unique UUID keys when no file name is supplied', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createLocalDriver(path.join(directory, 'storage'))
  await driver.init()
  const keys = []

  for (const suffix of ['a', 'b']) {
    const tempPath = path.join(directory, `${suffix}.tmp`)
    await fs.writeFile(tempPath, suffix)
    keys.push((await driver.save({ tempPath, folder: 'videos', ext: '.webm' })).key)
  }

  assert.notEqual(keys[0], keys[1])
  for (const key of keys) assert.match(key, /^videos\/[0-9a-f-]{36}\.webm$/i)
})

test('local driver rejects paths escaping the storage root and keeps the source file', async (t) => {
  const directory = await temporaryDirectory(t)
  const root = path.join(directory, 'storage')
  const driver = createLocalDriver(root)
  await driver.init()
  const tempPath = path.join(directory, 'upload.tmp')
  await fs.writeFile(tempPath, 'content')

  await assert.rejects(
    driver.save({ tempPath, folder: 'videos', fileName: '../outside.mp4' }),
    /Invalid storage key/,
  )
  await assert.rejects(
    driver.save({ tempPath, folder: '../outside', fileName: 'video.mp4' }),
    /Invalid storage key/,
  )
  assert.equal(await fs.readFile(tempPath, 'utf8'), 'content')
})

test('local driver stat reports missing files and remove is idempotent', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createLocalDriver(path.join(directory, 'storage'))
  await driver.init()

  await assert.rejects(driver.stat('missing.mp4'), { code: 'ENOENT' })
  await driver.remove('missing.mp4')
})

test('storageService forwards named folder and file name to the local driver', async (t) => {
  const directory = await temporaryDirectory(t)
  const tempPath = path.join(directory, 'upload.tmp')
  await fs.writeFile(tempPath, 'named upload')
  t.after(() => fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true }))
  await storageService.init()

  const stored = await storageService.save(
    { tempPath, originalName: 'browser-name.mp4', mimeType: 'video/mp4', ext: '.mp4' },
    { folder: 'videos/Travel', fileName: 'Named video.mp4' },
  )

  assert.equal(stored.key, 'videos/Travel/Named video.mp4')
  assert.equal(stored.originalName, 'browser-name.mp4')
  assert.equal(stored.size, 'named upload'.length)
  await storageService.remove(stored)
})

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
