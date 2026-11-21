import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalDriver } from '../../src/services/storage/localDriver.js'
import { storageService, temporaryDirectory } from '../support/videoServiceTestHelpers.js'
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

test('C5: startup removes temp files older than an hour and keeps newer files and subfolders', async (t) => {
  const directory = await temporaryDirectory(t)
  const root = path.join(directory, 'storage')
  const tempDir = path.join(root, 'tmp')
  await fs.mkdir(path.join(tempDir, 'nested'), { recursive: true })

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const stale = path.join(tempDir, 'stale-upload')
  const fresh = path.join(tempDir, 'upload-in-progress')
  const nestedStale = path.join(tempDir, 'nested', 'stale-but-nested')
  for (const file of [stale, fresh, nestedStale]) await fs.writeFile(file, 'bytes')
  await fs.utimes(stale, twoHoursAgo, twoHoursAgo)
  await fs.utimes(nestedStale, twoHoursAgo, twoHoursAgo)

  const logged = []
  const driver = createLocalDriver(root, { log: { info: (...args) => logged.push(args), warn: (...args) => logged.push(args) } })
  await driver.init()

  await assert.rejects(() => fs.stat(stale), { code: 'ENOENT' })
  assert.equal(await fs.readFile(fresh, 'utf8'), 'bytes')
  assert.equal(await fs.readFile(nestedStale, 'utf8'), 'bytes')
  assert.equal(logged.length, 1)
  assert.equal(logged[0][0].removed, 1)
})

test('C5: the startup sweep is a no-op on an empty or missing temp folder', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createLocalDriver(path.join(directory, 'fresh-storage'))
  await driver.init()
  await driver.init()
  assert.deepEqual(await fs.readdir(path.join(directory, 'fresh-storage', 'tmp')), [])
})
