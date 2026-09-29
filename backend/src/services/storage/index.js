import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'
import { createGoogleDriveDriver } from './googleDriveDriver.js'
import { createLocalDriver } from './localDriver.js'

const localDriver = createLocalDriver(path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.UPLOAD_DIR))

/**
 * Builds a gdrive driver instance under a given internal name, so two instances (one per
 * Google account/folder) can coexist. createGoogleDriveDriver always returns name: 'gdrive',
 * so we override it per instance; whatever name is stored on a StoredFile record at save time
 * is exactly what describe()/remove() later look up, so old records keep resolving to
 * whichever driver they were actually written with.
 */
const buildGdrive = (name, { serviceAccountJson, rootFolderId }) => ({
  ...createGoogleDriveDriver({ serviceAccountJson, rootFolderId }),
  name,
})

// Base videos/posters/demo: the original account + folder, unchanged.
const baseGdrive = env.STORAGE_DRIVER === 'gdrive'
  ? buildGdrive('gdrive', { serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON, rootFolderId: env.GOOGLE_DRIVE_FOLDER_ID })
  : null

// Archived recordings: a second account/folder when GOOGLE_ARCHIVE_* is set, so recordings
// live under separate credentials from base videos. Falls back to the shared credentials
// when the archive-specific vars are absent, so a single-Drive setup needs zero changes.
const archiveGdrive = env.ARCHIVE_STORAGE_DRIVER === 'gdrive'
  ? buildGdrive('gdrive-archive', {
      serviceAccountJson: env.GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON,
      rootFolderId: env.GOOGLE_ARCHIVE_DRIVE_FOLDER_ID || env.GOOGLE_DRIVE_FOLDER_ID,
    })
  : null

const drivers = {
  local: localDriver,
  ...(baseGdrive ? { gdrive: baseGdrive } : {}),
  ...(archiveGdrive ? { 'gdrive-archive': archiveGdrive } : {}),
}

const driverFor = (name) => {
  if (!drivers[name]) throw new Error(`Unknown storage driver "${name}"`)
  return drivers[name]
}

// New files go to the configured driver for their purpose. Existing files keep using the
// driver name recorded on them, so switching an env var later never orphans anything already
// uploaded, and old single-Drive recordings (driver: 'gdrive') keep resolving correctly even
// after ARCHIVE_STORAGE_DRIVER starts pointing new writes at 'gdrive-archive'.
const defaultDriver = () => driverFor(env.STORAGE_DRIVER)
const archiveDriverName = () => (env.ARCHIVE_STORAGE_DRIVER === 'gdrive' ? 'gdrive-archive' : env.ARCHIVE_STORAGE_DRIVER)

export const storageService = {
  tempDir: localDriver.tempDir,

  init: () => Promise.all(Object.values(drivers).map((driver) => driver.init?.())),

  /** Takes a finished temp upload and returns the reference to store on a document. */
  async save({ tempPath, originalName = '', mimeType, ext }, { folder }) {
    const driver = defaultDriver()
    const { key } = await driver.save({ tempPath, ext, folder, mimeType })
    const { size } = await driver.stat(key)
    return { driver: driver.name, key, mimeType, size, originalName: originalName.slice(0, 200) }
  },

  async archive({ tempPath, originalName = '', mimeType, ext, folder, fileName }) {
    const driver = driverFor(archiveDriverName())
    const { size } = await fs.stat(tempPath)
    const { key } = await driver.save({ tempPath, ext, folder, fileName, mimeType })
    return { driver: driver.name, key, mimeType, size, originalName: originalName.slice(0, 200), archivePath: `${folder}/${fileName || key}` }
  },

  /** Descriptor consumed by utils/sendFile. */
  async describe(ref) {
    const driver = driverFor(ref.driver)
    const { size } = await driver.stat(ref.key)
    return { size, mimeType: ref.mimeType, createReadStream: (range) => driver.createReadStream(ref.key, range) }
  },

  async remove(ref) {
    if (!ref) return
    try { await driverFor(ref.driver).remove(ref.key) } catch (error) { logger.error({ err: error, key: ref.key }, 'Could not delete stored file') }
  },
}
