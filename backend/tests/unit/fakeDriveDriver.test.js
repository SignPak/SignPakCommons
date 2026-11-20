import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createFakeDriveDriver } from '../support/fakeDriveDriver.js'
import { temporaryDirectory } from '../support/videoServiceTestHelpers.js'

const writeTemp = async (directory, name = 'take.webm', contents = 'recording bytes') => {
  const tempPath = path.join(directory, name)
  await fs.writeFile(tempPath, contents)
  return tempPath
}

const readAll = async (stream) => {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

test('fake Drive driver exposes the same interface as the real Google Drive driver', async () => {
  const { createGoogleDriveDriver } = await import('../../src/services/storage/googleDriveDriver.js')
  const real = createGoogleDriveDriver({
    oauth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'token' },
    rootFolderId: 'root-folder',
    driverName: 'gdrive',
  })
  const fake = createFakeDriveDriver()

  for (const member of Object.keys(real)) {
    assert.equal(typeof fake[member], typeof real[member], `fake driver is missing ${member}`)
  }
  assert.equal(fake.name, real.name)
})

test('fake Drive driver stores bytes under an opaque key and leaves the temp file alone', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createFakeDriveDriver()
  await driver.init()
  const tempPath = await writeTemp(directory)

  const { key } = await driver.save({
    tempPath,
    ext: '.webm',
    folder: 'commons/user-1/daily/hello',
    fileName: 'hello.webm',
    mimeType: 'video/webm',
  })

  assert.match(key, /^fake-drive-/)
  assert.ok(!key.includes('hello.webm'), 'the key must stay opaque, like a Drive file id')
  assert.equal((await driver.stat(key)).size, 'recording bytes'.length)
  assert.equal(await readAll(await driver.createReadStream(key)), 'recording bytes')
  // The real Drive driver uploads a copy; only the local driver consumes tempPath.
  assert.equal(await fs.readFile(tempPath, 'utf8'), 'recording bytes')
})

test('fake Drive driver reuses one folder id per path and creates nested folders once', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createFakeDriveDriver()

  const first = await driver.save({ tempPath: await writeTemp(directory, 'a.webm', 'a'), folder: 'commons/one', fileName: 'a.webm' })
  const second = await driver.save({ tempPath: await writeTemp(directory, 'b.webm', 'b'), folder: 'commons/one', fileName: 'b.webm' })
  const other = await driver.save({ tempPath: await writeTemp(directory, 'c.webm', 'c'), folder: 'commons/two', fileName: 'c.webm' })

  assert.equal(driver.files.get(first.key).parentId, driver.files.get(second.key).parentId)
  assert.notEqual(driver.files.get(first.key).parentId, driver.files.get(other.key).parentId)
  assert.deepEqual([...driver.folders.keys()], ['/commons', '/commons/one', '/commons/two'])
})

test('fake Drive driver supports byte ranges and idempotent removal', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createFakeDriveDriver()
  const { key } = await driver.save({ tempPath: await writeTemp(directory, 'range.webm', '0123456789'), folder: 'videos', fileName: 'range.webm' })

  assert.equal(await readAll(await driver.createReadStream(key, { start: 2, end: 5 })), '2345')
  await driver.remove(key)
  await driver.remove(key) // removing twice is fine, like a swallowed Drive 404
  await assert.rejects(() => driver.stat(key), /not found/)
})

test('fake Drive driver can be told to fail on save, stat and remove', async (t) => {
  const directory = await temporaryDirectory(t)
  const driver = createFakeDriveDriver()
  const tempPath = await writeTemp(directory, 'fail.webm', 'bytes')

  driver.failOn.save = new Error('Drive quota exceeded')
  await assert.rejects(() => driver.save({ tempPath, folder: 'videos', fileName: 'fail.webm' }), /quota/)
  // One-shot by default: the next save works again.
  const { key } = await driver.save({ tempPath, folder: 'videos', fileName: 'fail.webm' })

  driver.failOn.stat = true
  await assert.rejects(() => driver.stat(key), /told to fail on stat/)

  driver.failOn.remove = { sticky: true, error: new Error('Drive unavailable') }
  await assert.rejects(() => driver.remove(key), /unavailable/)
  await assert.rejects(() => driver.remove(key), /unavailable/)
  assert.equal(driver.files.has(key), true)

  driver.reset()
  assert.equal(driver.files.size, 0)
  assert.equal(driver.failOn.remove, null)
})
