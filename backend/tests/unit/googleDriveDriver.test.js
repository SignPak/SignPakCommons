import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { google } from 'googleapis'
import { temporaryDirectory } from '../support/videoServiceTestHelpers.js'
import { createGoogleDriveDriver } from '../../src/services/storage/googleDriveDriver.js'
import { parseServiceAccountCredentials } from '../../src/utils/parseCredentials.js'

/**
 * The real Google Drive driver against an in-process stand-in for the Drive v3 API
 * (`google.drive` is replaced for each test), so no network and no credentials are needed.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const nextTick = () => new Promise((resolve) => setImmediate(resolve))

function fakeDriveApi() {
  const folders = new Map() // `${parentId}/${name}` -> folder id
  const calls = { list: 0, createFolder: 0, upload: 0 }
  const failures = { list: 0 }
  return {
    calls,
    failures,
    folders,
    files: {
      async list({ q }) {
        calls.list += 1
        await nextTick() // a real lookup takes time; concurrent uploads interleave here
        if (failures.list > 0) {
          failures.list -= 1
          throw new Error('Drive list failed')
        }
        const [, parentId, name] = /^'(.+?)' in parents and name = '(.+?)' and /.exec(q)
        const id = folders.get(`${parentId}/${name}`)
        return { data: { files: id ? [{ id }] : [] } }
      },
      async create({ requestBody, media }) {
        await nextTick()
        if (requestBody.mimeType === FOLDER_MIME) {
          calls.createFolder += 1
          const id = `folder-${calls.createFolder}`
          folders.set(`${requestBody.parents[0]}/${requestBody.name}`, id)
          return { data: { id } }
        }
        calls.upload += 1
        media?.body?.destroy?.()
        return { data: { id: `file-${calls.upload}` } }
      },
      async get() { return { data: { id: 'root', trashed: false } } },
      async delete() {},
    },
  }
}

function driverWithFakeApi(t) {
  const api = fakeDriveApi()
  t.mock.method(google, 'drive', () => api)
  const driver = createGoogleDriveDriver({
    oauth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'token' },
    rootFolderId: 'root',
  })
  return { api, driver }
}

async function tempFile(t) {
  const directory = await temporaryDirectory(t)
  const file = path.join(directory, 'take.webm')
  await fs.writeFile(file, 'bytes')
  return file
}

test('B8: concurrent uploads to the same folder path create each Drive folder exactly once', async (t) => {
  const { api, driver } = driverWithFakeApi(t)
  const folder = 'commons/user-1_0/daily/hello'

  const saves = await Promise.all([1, 2, 3].map(async () => driver.save({
    tempPath: await tempFile(t), ext: '.webm', folder, fileName: 'hello.webm', mimeType: 'video/webm',
  })))

  assert.equal(saves.length, 3)
  assert.equal(api.calls.upload, 3, 'every file is uploaded')
  assert.equal(api.calls.createFolder, 4, 'one folder per path segment, not one per upload')
  assert.equal(api.calls.list, 4, 'each segment is looked up once and the result shared')
  assert.equal(api.folders.size, 4)
})

test('B8: sibling paths share their common parent folders', async (t) => {
  const { api, driver } = driverWithFakeApi(t)

  await Promise.all(['commons/a/daily', 'commons/b/daily'].map(async (folder) => driver.save({
    tempPath: await tempFile(t), ext: '.webm', folder, fileName: 'x.webm', mimeType: 'video/webm',
  })))

  // commons (shared) + a + a/daily + b + b/daily
  assert.equal(api.calls.createFolder, 5)
})

test('B8: a failed folder lookup is retried by the next upload, not cached', async (t) => {
  const { api, driver } = driverWithFakeApi(t)
  api.failures.list = 1

  await assert.rejects(() => tempFile(t).then((tempPath) => driver.save({ tempPath, folder: 'videos', fileName: 'a.mp4', mimeType: 'video/mp4' })), /Drive list failed/)
  const saved = await driver.save({ tempPath: await tempFile(t), folder: 'videos', fileName: 'b.mp4', mimeType: 'video/mp4' })

  assert.ok(saved.key)
  assert.equal(api.calls.createFolder, 1)
})

test('the Drive driver reads service-account JSON through utils/parseCredentials.js', (t) => {
  t.mock.method(google, 'drive', () => fakeDriveApi())
  let received
  t.mock.method(google.auth, 'GoogleAuth', function GoogleAuth(options) { received = options })

  const json = JSON.stringify({ client_email: 'svc@project.iam.gserviceaccount.com', private_key: '-----BEGIN KEY-----\\nabc\\n-----END KEY-----' })
  createGoogleDriveDriver({ serviceAccountJson: `'${json}'`, rootFolderId: 'root' })

  assert.equal(received.credentials.client_email, 'svc@project.iam.gserviceaccount.com')
  assert.equal(received.credentials.private_key, '-----BEGIN KEY-----\nabc\n-----END KEY-----')
  assert.deepEqual(received.scopes, ['https://www.googleapis.com/auth/drive'])
})

test('the Drive driver still names itself when no credentials are configured', () => {
  assert.throws(() => createGoogleDriveDriver({ rootFolderId: 'root', driverName: 'gdrive-archive' }), /^Error: \[gdrive-archive\] Missing Google credentials\.$/)
})

test('parseServiceAccountCredentials accepts quoted and double-encoded JSON and fixes key newlines', () => {
  const object = { client_email: 'svc@x', private_key: 'a\\nb' }
  const plain = JSON.stringify(object)
  // As stored in an env value: plain, wrapped in single quotes, double-encoded, or padded.
  for (const raw of [plain, `'${plain}'`, JSON.stringify(plain), `  ${plain}  `]) {
    const parsed = parseServiceAccountCredentials(raw)
    assert.equal(parsed.client_email, 'svc@x', raw)
    assert.equal(parsed.private_key, 'a\nb', raw)
  }
  assert.throws(() => parseServiceAccountCredentials('{not json'), /Failed to parse Service Account JSON/)
  assert.throws(() => parseServiceAccountCredentials(''), /missing/)
})
