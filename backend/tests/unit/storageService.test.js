import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { storageService, temporaryDirectory } from '../support/videoServiceTestHelpers.js'
import { createFakeDriveDriver } from '../support/fakeDriveDriver.js'
import { INVALID_GRANT_MESSAGE, isInvalidGrant, routeStorageForTests } from '../../src/services/storage/index.js'
import { logger } from '../../src/utils/logger.js'

const exists = (file) => fs.stat(file).then(() => true, () => false)

async function tempUpload(directory, name = 'upload.tmp') {
  const tempPath = path.join(directory, name)
  await fs.writeFile(tempPath, 'video bytes')
  return tempPath
}

/** Routes storage to two fake Drive drivers for the length of one test. */
function useFakeDrive(t) {
  const primary = createFakeDriveDriver({ name: 'gdrive' })
  const archive = createFakeDriveDriver({ name: 'gdrive-archive' })
  t.after(routeStorageForTests({ primary, archive }))
  return { primary, archive }
}

// The shape googleapis/gaxios gives a token refresh that Google refused.
const invalidGrantError = () => Object.assign(new Error('invalid_grant'), {
  response: { status: 400, data: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } },
})

test('C5: removes the temp file after a Drive upload', async (t) => {
  const { primary } = useFakeDrive(t)
  const directory = await temporaryDirectory(t)
  const tempPath = await tempUpload(directory)

  const ref = await storageService.save({ tempPath, mimeType: 'video/mp4', ext: '.mp4' }, { folder: 'videos/Daily', fileName: 'Hello.mp4' })

  assert.equal(ref.driver, 'gdrive')
  assert.equal(primary.files.size, 1, 'the file is in (fake) Drive')
  assert.equal(await exists(tempPath), false, 'and no longer in uploads/tmp')
})

test('C5: removes the temp file after a Drive archive (contributor recording)', async (t) => {
  const { archive } = useFakeDrive(t)
  const directory = await temporaryDirectory(t)
  const tempPath = await tempUpload(directory)

  const ref = await storageService.archive({ tempPath, mimeType: 'video/webm', ext: '.webm', folder: 'commons/u_1/daily/hello', fileName: 'hello.webm' })

  assert.equal(ref.driver, 'gdrive-archive')
  assert.equal(archive.files.size, 1)
  assert.equal(await exists(tempPath), false)
})

test('C5: removes the temp file when the Drive upload fails, too', async (t) => {
  const { primary, archive } = useFakeDrive(t)
  const directory = await temporaryDirectory(t)

  primary.failOn.save = new Error('Drive unavailable')
  const forSave = await tempUpload(directory, 'save.tmp')
  await assert.rejects(() => storageService.save({ tempPath: forSave, mimeType: 'video/mp4', ext: '.mp4' }, { folder: 'videos' }), { code: 'STORAGE_ERROR' })
  assert.equal(await exists(forSave), false)

  archive.failOn.save = new Error('Drive unavailable')
  const forArchive = await tempUpload(directory, 'archive.tmp')
  await assert.rejects(() => storageService.archive({ tempPath: forArchive, mimeType: 'video/webm', ext: '.webm', folder: 'commons' }), { code: 'STORAGE_ERROR' })
  assert.equal(await exists(forArchive), false)
})

test('D3: an invalid_grant from Drive logs the clear refresh-token message', async (t) => {
  const { primary } = useFakeDrive(t)
  const errors = t.mock.method(logger, 'error', () => {})
  const directory = await temporaryDirectory(t)

  primary.failOn.save = invalidGrantError()
  const tempPath = await tempUpload(directory)
  await assert.rejects(() => storageService.save({ tempPath, mimeType: 'video/mp4', ext: '.mp4' }, { folder: 'videos' }))

  const clear = errors.mock.calls.find((call) => call.arguments[1] === INVALID_GRANT_MESSAGE)
  assert.ok(clear, 'the refresh-token message is logged')
  assert.equal(clear.arguments[0].driver, 'gdrive')
  assert.match(clear.arguments[0].replace, /GOOGLE_OAUTH_REFRESH_TOKEN/)
})

test('D3: an invalid_grant while initializing storage logs the message and still fails startup', async (t) => {
  const { archive } = useFakeDrive(t)
  const errors = t.mock.method(logger, 'error', () => {})
  t.mock.method(archive, 'init', async () => { throw invalidGrantError() })

  await assert.rejects(() => storageService.init(), /invalid_grant/)
  const clear = errors.mock.calls.find((call) => call.arguments[1] === INVALID_GRANT_MESSAGE)
  assert.ok(clear)
  assert.equal(clear.arguments[0].driver, 'gdrive-archive')
  assert.match(clear.arguments[0].replace, /GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN/)
})

test('D3: other storage failures do not mention the refresh token', async (t) => {
  const { primary } = useFakeDrive(t)
  const errors = t.mock.method(logger, 'error', () => {})
  const directory = await temporaryDirectory(t)

  primary.failOn.save = Object.assign(new Error('quotaExceeded'), { response: { status: 403, data: { error: 'quotaExceeded' } } })
  const tempPath = await tempUpload(directory)
  await assert.rejects(() => storageService.save({ tempPath, mimeType: 'video/mp4', ext: '.mp4' }, { folder: 'videos' }))
  assert.equal(errors.mock.calls.some((call) => call.arguments[1] === INVALID_GRANT_MESSAGE), false)
})

test('D3: invalid_grant is recognised in the shapes googleapis produces', () => {
  assert.equal(isInvalidGrant(invalidGrantError()), true)
  assert.equal(isInvalidGrant(new Error('Google Drive upload session creation failed (400): {"error":"invalid_grant"}')), true)
  assert.equal(isInvalidGrant(new Error('wrapped', { cause: invalidGrantError() })), true)
  assert.equal(isInvalidGrant(new Error('ECONNRESET')), false)
  assert.equal(isInvalidGrant(undefined), false)
})

test('the storage test seam refuses to run outside NODE_ENV=test', () => {
  const script = `
    const { routeStorageForTests } = await import('./src/services/storage/index.js')
    try { routeStorageForTests({}); console.log('allowed') } catch (error) { console.log('refused: ' + error.message) }
  `
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://127.0.0.1/unused',
      JWT_SECRET: 'storage-seam-test-secret-storage-seam-test',
      ADMIN_EMAIL: 'admin@signpak.test',
      ADMIN_PASSWORD: 'Admin@12345',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(output.trim(), /^refused: routeStorageForTests\(\) is only available when NODE_ENV=test\./)
})
