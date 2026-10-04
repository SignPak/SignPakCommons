import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'
import { createGoogleDriveDriver } from './googleDriveDriver.js'
import { createLocalDriver } from './localDriver.js'

const localDriver = createLocalDriver(
  path.resolve(process.env.VERCEL ? os.tmpdir() : process.cwd(), env.UPLOAD_DIR)
)

/**
 * Builds a Google Drive driver instance with a explicit instance name
 * so that primary ('gdrive') and archive ('gdrive-archive') drivers can coexist seamlessly.
 */
const buildGdrive = (driverName, { serviceAccountJson, rootFolderId }) =>
  createGoogleDriveDriver({
    serviceAccountJson,
    rootFolderId,
    driverName,
  })

// Base videos/posters/demo: primary account + folder
const baseGdrive =
  env.STORAGE_DRIVER === 'gdrive'
    ? buildGdrive('gdrive', {
        serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
        rootFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
      })
    : null

// Archived recordings: secondary account/folder when GOOGLE_ARCHIVE_* env vars are set;
// falls back to shared primary credentials when archive vars are omitted.
const archiveGdrive =
  env.ARCHIVE_STORAGE_DRIVER === 'gdrive'
    ? buildGdrive('gdrive-archive', {
        serviceAccountJson:
          env.GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON,
        rootFolderId:
          env.GOOGLE_ARCHIVE_DRIVE_FOLDER_ID || env.GOOGLE_DRIVE_FOLDER_ID,
      })
    : null

const drivers = {
  local: localDriver,
  ...(baseGdrive ? { gdrive: baseGdrive } : {}),
  ...(archiveGdrive ? { 'gdrive-archive': archiveGdrive } : {}),
}

const driverFor = (name) => {
  const driver = drivers[name]
  if (!driver) throw new Error(`Unknown storage driver "${name}"`)
  return driver
}

// New files use the driver configured for their intent.
// Stored records keep their recorded driver name ('gdrive' vs 'gdrive-archive')
// so switching configuration never breaks or orphans existing uploads.
const defaultDriver = () => driverFor(env.STORAGE_DRIVER)
const archiveDriverName = () =>
  env.ARCHIVE_STORAGE_DRIVER === 'gdrive' ? 'gdrive-archive' : env.ARCHIVE_STORAGE_DRIVER

export const storageService = {
  tempDir: localDriver.tempDir,

  init: () => Promise.all(Object.values(drivers).map((driver) => driver.init?.())),

  /** Saves standard upload files to the primary storage driver. */
  async save({ tempPath, originalName = '', mimeType, ext }, { folder }) {
    const driver = defaultDriver()
    const { key } = await driver.save({ tempPath, ext, folder, mimeType })
    const { size } = await driver.stat(key)
    return {
      driver: driver.name,
      key,
      mimeType,
      size,
      originalName: originalName.slice(0, 200),
    }
  },

  /** Saves archive recordings to the dedicated archive storage driver. */
  async archive({ tempPath, originalName = '', mimeType, ext, folder, fileName }) {
    const driver = driverFor(archiveDriverName())
    const { size } = await fs.stat(tempPath)
    const { key } = await driver.save({ tempPath, ext, folder, fileName, mimeType })
    return {
      driver: driver.name,
      key,
      mimeType,
      size,
      originalName: originalName.slice(0, 200),
      archivePath: `${folder}/${fileName || key}`,
    }
  },

  /** Returns readable file stream descriptor by looking up stored driver name. */
  async describe(ref) {
    const driver = driverFor(ref.driver)
    const { size } = await driver.stat(ref.key)
    return {
      size,
      mimeType: ref.mimeType,
      createReadStream: (range) => driver.createReadStream(ref.key, range),
    }
  },

  /** Removes stored file using its associated driver. */
  async remove(ref) {
    if (!ref) return
    try {
      await driverFor(ref.driver).remove(ref.key)
    } catch (error) {
      logger.error({ err: error, key: ref.key }, 'Could not delete stored file')
    }
  },
}
