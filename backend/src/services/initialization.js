import { API_PREFIX } from '../config/constants.js'
import { connectDb, isDbReady } from '../config/db.js'
import { env } from '../config/env.js'
import { authService } from './authService.js'
import { storageService } from './storage/index.js'
import { logger } from '../utils/logger.js'

let initPromise = null
let storageReady = false

/** True once every configured storage driver has initialized. Reported by the health check. */
export const isStorageReady = () => storageReady

export function initServices() {
  if (!initPromise) {
    initPromise = (async () => {
      logger.info('Connecting to MongoDB')
      if (!isDbReady()) await connectDb()

      logger.info('Initializing storage')
      await storageService.init()
      storageReady = true

      logger.info('Bootstrapping the admin account')
      await authService.ensureAdminFromEnv()

      logger.info('All services initialized')
    })().catch((error) => {
      initPromise = null
      logger.fatal({ err: error }, 'Failed to initialize background services')
      throw error
    })
  }
  return initPromise
}

/**
 * S5: the 503 body. The underlying error can name hosts, credentials or file paths (a
 * malformed MONGODB_URI is echoed back verbatim by the driver), so it is only included outside
 * production, where it saves a trip to the logs. Production clients get the generic message;
 * the full error is in the server log either way.
 */
export function serviceUnavailableBody(error, { isProduction }) {
  const body = { code: 'SERVICE_UNAVAILABLE', message: 'Service initializing or misconfigured.' }
  if (!isProduction && error?.message) body.detail = error.message
  return { error: body }
}

const HEALTH_PATH = `${API_PREFIX}/health`

export async function ensureServicesInitialized(req, res, next) {
  if (req.method === 'OPTIONS') return next()
  // The health check reports a failed initialization itself (database and storage status), so
  // it is let through instead of being replaced by the generic 503 below. It still starts the
  // initialization, so a fresh process becomes healthy on its own.
  if (req.method === 'GET' && req.path === HEALTH_PATH) {
    await initServices().catch(() => {})
    return next()
  }
  try {
    await initServices()
    return next()
  } catch (error) {
    const origin = req.headers.origin
    if (origin && env.clientOrigins?.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
    }
    return res.status(503).json(serviceUnavailableBody(error, { isProduction: env.isProduction }))
  }
}
