import { API_PREFIX } from '../config/constants.js'
import { connectDb, isDbReady } from '../config/db.js'
import { env } from '../config/env.js'
import { userRepo } from '../repositories/userRepo.js'
import { authService } from './authService.js'
import { storageService } from './storage/index.js'
import { logger } from '../utils/logger.js'

let initPromise = null
let storageReady = false
let storagePromise = null
let lastStorageAttempt = 0
// The health checks retry a failed storage start at most this often (Docker probes every 30 s).
let storageRetryIntervalMs = 30_000

/** True once every configured storage driver has initialized. Reported by the health check. */
export const isStorageReady = () => storageReady

/**
 * Phase 11 (D1): storage is started separately and its failure does not fail initialization.
 * A Google Drive token that is expired or revoked at startup (D3) used to make every request
 * answer 503, login and browsing included. Now only what needs storage fails (uploads and
 * playback from Drive); /health reports storage: false and answers 503, and the health checks
 * retry it (retryStorage below), so it recovers without a restart once Google answers again.
 */
function initStorage() {
  if (!storagePromise) {
    lastStorageAttempt = Date.now()
    storagePromise = storageService.init()
      .then(() => {
        storageReady = true
        logger.info('Storage initialized')
      })
      .catch((error) => {
        logger.error({ err: error }, 'Storage failed to initialize: uploads and playback from storage fail until it does; the rest of the API works')
      })
      .finally(() => { storagePromise = null })
  }
  return storagePromise
}

/** Tries a failed storage start again, at most once per interval. Called by the health checks. */
export function retryStorage() {
  if (storageReady || !initPromise) return Promise.resolve()
  if (!storagePromise && Date.now() - lastStorageAttempt < storageRetryIntervalMs) return Promise.resolve()
  return initStorage()
}

/** Test seam (NODE_ENV=test only): how often the health checks may retry storage. */
export function setStorageRetryIntervalForTests(ms) {
  if (!env.isTest) throw new Error('setStorageRetryIntervalForTests() is only available when NODE_ENV=test.')
  storageRetryIntervalMs = ms
}

export function initServices() {
  if (!initPromise) {
    initPromise = (async () => {
      logger.info('Connecting to MongoDB')
      if (!isDbReady()) await connectDb()

      // Never throws: a storage failure is logged and reported by the health check.
      logger.info('Initializing storage')
      if (!storageReady) await initStorage()

      logger.info('Bootstrapping the admin account')
      await authService.ensureAdminFromEnv()

      // S9: give unfinished sign-ups from before the TTL index an expiry.
      await userRepo.backfillSignupExpiry()

      logger.info({ storage: storageReady }, storageReady ? 'All services initialized' : 'Services initialized without storage')
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

// Both health checks: /health (database and storage) and /health/live (the container's check).
const HEALTH_PATHS = new Set([`${API_PREFIX}/health`, `${API_PREFIX}/health/live`])

export async function ensureServicesInitialized(req, res, next) {
  if (req.method === 'OPTIONS') return next()
  // The health checks report a failed initialization themselves (database and storage
  // status), so they are let through instead of being replaced by the generic 503 below. They
  // still start the initialization, and retry a failed storage start, so a fresh process
  // becomes healthy on its own.
  if (req.method === 'GET' && HEALTH_PATHS.has(req.path)) {
    await initServices().catch(() => {})
    await retryStorage()
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
