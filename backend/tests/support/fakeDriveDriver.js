import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'

/**
 * In-memory stand-in for src/services/storage/googleDriveDriver.js, for tests that need
 * Drive-like behaviour without Google: opaque file-id keys (so a test cannot assume a path),
 * folders created on demand, and the same save/stat/createReadStream/remove surface.
 *
 * Unlike the local driver, save() does NOT consume tempPath — exactly like the real Drive
 * driver, which is what makes the C5 temp-file leak visible in a test.
 *
 * Failure injection:
 *   driver.failOn.save = new Error('quota')   // next save rejects
 *   driver.failOn.remove = true               // next remove rejects with a default error
 * Each switch clears itself after it fires once, unless you set `{ sticky: true }`.
 */
export function createFakeDriveDriver({ name = 'gdrive', rootFolderId = 'fake-root' } = {}) {
  /** key -> { key, folder, fileName, mimeType, ext, size, body } */
  const files = new Map()
  /** folder path -> folder id, mirroring the real driver's folder cache */
  const folders = new Map()
  const calls = { init: 0, save: 0, stat: 0, read: 0, remove: 0 }

  const failOn = { save: null, stat: null, remove: null }

  const maybeFail = (operation) => {
    const trigger = failOn[operation]
    if (!trigger) return
    if (!trigger.sticky) failOn[operation] = null
    const error = trigger instanceof Error ? trigger : trigger.error instanceof Error ? trigger.error : null
    throw error ?? new Error(`Fake Drive driver was told to fail on ${operation}`)
  }

  const folderIdFor = (folder) => {
    if (!folder) return rootFolderId
    let parent = rootFolderId
    let cacheKey = ''
    for (const segment of String(folder).split('/').filter(Boolean)) {
      cacheKey = `${cacheKey}/${segment}`
      if (!folders.has(cacheKey)) folders.set(cacheKey, `folder-${folders.size + 1}`)
      parent = folders.get(cacheKey)
    }
    return parent
  }

  return {
    name,
    // The real Drive driver has no temp directory of its own (it reports null); uploads land
    // in the local driver's tempDir first, and storageService hands over the path.
    tempDir: null,

    get files() { return files },
    get folders() { return folders },
    get calls() { return calls },
    failOn,

    reset() {
      files.clear()
      folders.clear()
      failOn.save = null
      failOn.stat = null
      failOn.remove = null
      for (const key of Object.keys(calls)) calls[key] = 0
    },

    async init() {
      calls.init += 1
    },

    async save({ tempPath, ext = '', folder, fileName, mimeType }) {
      calls.save += 1
      maybeFail('save')
      const body = await fs.readFile(tempPath)
      const key = `fake-drive-${randomUUID()}`
      files.set(key, {
        key,
        parentId: folderIdFor(folder),
        folder,
        fileName: fileName || `${key}${ext}`,
        mimeType,
        ext,
        size: body.byteLength,
        body,
      })
      return { key }
    },

    async stat(key) {
      calls.stat += 1
      maybeFail('stat')
      const file = files.get(key)
      if (!file) {
        const error = new Error(`Fake Drive file not found: ${key}`)
        error.code = 404
        throw error
      }
      return { size: file.size }
    },

    async createReadStream(key, range) {
      calls.read += 1
      const file = files.get(key)
      if (!file) {
        const error = new Error(`Fake Drive file not found: ${key}`)
        error.code = 404
        throw error
      }
      const body = range ? file.body.subarray(range.start, range.end + 1) : file.body
      return Readable.from(body)
    },

    async remove(key) {
      calls.remove += 1
      maybeFail('remove')
      files.delete(key) // idempotent, like the real driver swallowing a 404
    },
  }
}
