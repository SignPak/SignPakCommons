import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'
import { removeQuietly } from '../../utils/files.js'
import { logger } from '../../utils/logger.js'
import { createGoogleDriveDriver } from './googleDriveDriver.js'
import { createLocalDriver } from './localDriver.js'

// UPLOAD_DIR is resolved against the working directory (backend/ under PM2, see
// deploy/ecosystem.config.cjs); an absolute UPLOAD_DIR is used as-is.
const localDriver = createLocalDriver(path.resolve(process.cwd(), env.UPLOAD_DIR), { log: logger })

/**
 * Builds a Google Drive driver instance with a explicit instance name
 * so that primary ('gdrive') and archive ('gdrive-archive') drivers can coexist seamlessly.
 */
const baseOauth = {
  clientId: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN,
}

const archiveOauth = {
  clientId: env.GOOGLE_ARCHIVE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET,
  refreshToken: env.GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN,
}

const hasArchiveOauth = Object.values(archiveOauth).every(Boolean)

const buildGdrive = (driverName, { serviceAccountJson, oauth, rootFolderId }) =>
  createGoogleDriveDriver({
    serviceAccountJson,
    oauth,
    rootFolderId,
    driverName,
  })

// Base videos/posters/demo: primary account + folder
const baseGdrive =
  env.STORAGE_DRIVER === 'gdrive'
    ? buildGdrive('gdrive', {
        serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
        oauth: baseOauth,
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
        oauth: hasArchiveOauth
          ? archiveOauth
          : env.GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON
            ? null
            : baseOauth,
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

// Test seam (NODE_ENV=test only): routes new files to substitute drivers, such as the in-memory
// Google Drive stand-in in tests/support/fakeDriveDriver.js, without Google credentials.
let testRouting = null

/**
 * Routes new uploads and archives to the given drivers (registered under their own `name`, so
 * stored references resolve to them too). Returns a function that restores the real drivers.
 * Throws outside NODE_ENV=test, so it can never change where production files go.
 */
export function routeStorageForTests({ primary, archive } = {}) {
  if (!env.isTest) throw new Error('routeStorageForTests() is only available when NODE_ENV=test.')
  const previous = { ...drivers }
  if (primary) drivers[primary.name] = primary
  if (archive) drivers[archive.name] = archive
  testRouting = { primary: primary?.name, archive: archive?.name }
  return () => {
    testRouting = null
    for (const name of Object.keys(drivers)) delete drivers[name]
    Object.assign(drivers, previous)
  }
}

// New files use the driver configured for their intent.
// Stored records keep their recorded driver name ('gdrive' vs 'gdrive-archive')
// so switching configuration never breaks or orphans existing uploads.
const defaultDriver = () => driverFor(testRouting?.primary ?? env.STORAGE_DRIVER)
const archiveDriverName = () =>
  testRouting?.archive ?? (env.ARCHIVE_STORAGE_DRIVER === 'gdrive' ? 'gdrive-archive' : env.ARCHIVE_STORAGE_DRIVER)

/**
 * D3: Google answers `invalid_grant` when the OAuth refresh token has expired or been revoked,
 * most often because the OAuth consent screen was left in "Testing" mode, where tokens last
 * 7 days. Every upload then fails, so say exactly that in the log instead of a bare 502.
 */
export const INVALID_GRANT_MESSAGE =
  'Google Drive refresh token expired or revoked; make sure the OAuth app is In production and create a new token'

const TOKEN_VARIABLE = {
  gdrive: 'GOOGLE_OAUTH_REFRESH_TOKEN',
  'gdrive-archive': 'GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN (or GOOGLE_OAUTH_REFRESH_TOKEN when the archive shares it)',
}

/** True for Google's invalid_grant, wherever googleapis/gaxios puts it (data, message or cause). */
export function isInvalidGrant(err) {
  for (let current = err, depth = 0; current && depth < 5; current = current.cause, depth += 1) {
    if (current.response?.data?.error === 'invalid_grant') return true
    if (typeof current.message === 'string' && current.message.includes('invalid_grant')) return true
  }
  return false
}

function reportInvalidGrant(err, driverName) {
  if (!isInvalidGrant(err)) return
  logger.error({ driver: driverName, replace: TOKEN_VARIABLE[driverName] ?? 'the Google OAuth refresh token' }, INVALID_GRANT_MESSAGE)
}

const throwStorageError = (err, action, driverName) => {
  reportInvalidGrant(err, driverName)
  logger.error(
    {
      err,
      action,
      googleStatus: err?.code ?? err?.response?.status,
      googleBody: err?.response?.data ?? err?.errors,
    },
    'Storage operation failed'
  )
  throw new AppError(502, 'STORAGE_ERROR', 'The video could not be stored. Try again later.')
}

export const storageService = {
  tempDir: localDriver.tempDir,

  init: () => Promise.all(Object.entries(drivers).map(async ([name, driver]) => {
    try {
      await driver.init?.()
    } catch (err) {
      reportInvalidGrant(err, name)
      throw err
    }
  })),

  /**
   * Saves standard upload files to the primary storage driver. The temp file is deleted
   * afterwards whatever happened (C5): the local driver moves it, but the Drive driver only
   * reads it, so without this every upload would stay in uploads/tmp.
   */
  async save({ tempPath, originalName = '', mimeType, ext }, { folder, fileName }) {
    const driver = defaultDriver()
    try {
      const { key } = await driver.save({ tempPath, ext, folder, fileName, mimeType })
      const { size } = await driver.stat(key)
      return {
        driver: driver.name,
        key,
        mimeType,
        size,
        originalName: originalName.slice(0, 200),
      }
    } catch (err) {
      throwStorageError(err, 'save', driver.name)
    } finally {
      await removeQuietly(tempPath)
    }
  },

  /** Saves archive recordings to the dedicated archive storage driver; the temp file is deleted afterwards (C5). */
  async archive({ tempPath, originalName = '', mimeType, ext, folder, fileName }) {
    const driver = driverFor(archiveDriverName())
    try {
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
    } catch (err) {
      throwStorageError(err, 'save', driver.name)
    } finally {
      await removeQuietly(tempPath)
    }
  },

  /** Returns readable file stream descriptor by looking up stored driver name. */
  async describe(ref, cachedMetadata) {
    const driver = driverFor(ref.driver)
    try {
      const { size } = cachedMetadata ?? await driver.stat(ref.key)
      return {
        size,
        mimeType: cachedMetadata?.mimeType ?? ref.mimeType,
        createReadStream: (range) => driver.createReadStream(ref.key, range),
      }
    } catch (err) {
      throwStorageError(err, 'stat', ref.driver)
    }
  },

  /** Removes stored file using its associated driver. */
  async remove(ref) {
    if (!ref) return
    try {
      await driverFor(ref.driver).remove(ref.key)
    } catch (err) {
      throwStorageError(err, 'remove', ref.driver)
    }
  },
}
