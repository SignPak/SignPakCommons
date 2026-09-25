import path from 'node:path'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'
import { createLocalDriver } from './localDriver.js'

const drivers = { local: createLocalDriver(path.resolve(env.UPLOAD_DIR)) }
const driverFor = (name) => {
  if (!drivers[name]) throw new Error(`Unknown storage driver "${name}"`)
  return drivers[name]
}
// New files go to the configured driver. Existing files keep using the driver recorded on them,
// so switching to Google Drive later does not orphan anything already uploaded.
const defaultDriver = () => driverFor(env.STORAGE_DRIVER)

export const storageService = {
  tempDir: drivers.local.tempDir,

  init: () => Promise.all(Object.values(drivers).map((driver) => driver.init?.())),

  /** Takes a finished temp upload and returns the reference to store on a document. */
  async save({ tempPath, originalName = '', mimeType, ext }, { folder }) {
    const driver = defaultDriver()
    const { key } = await driver.save({ tempPath, ext, folder })
    const { size } = await driver.stat(key)
    return { driver: driver.name, key, mimeType, size, originalName: originalName.slice(0, 200) }
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
