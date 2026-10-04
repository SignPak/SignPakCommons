import { connectDb, isDbReady } from '../config/db.js'
import { env } from '../config/env.js'
import { authService } from './authService.js'
import { storageService } from './storage/index.js'
import { logger } from '../utils/logger.js'

let initPromise = null

export function initServices() {
  if (!initPromise) {
    initPromise = (async () => {
      console.log('[INIT] Connecting to MongoDB...')
      if (!isDbReady()) await connectDb()

      console.log('[INIT] Initializing Storage Service...')
      await storageService.init()

      console.log('[INIT] Bootstrapping Admin Account...')
      await authService.ensureAdminFromEnv()

      console.log('[INIT] All services initialized successfully.')
    })().catch((error) => {
      initPromise = null
      console.error('[INIT FATAL ERROR]', error)
      logger.fatal({ err: error }, 'Failed to initialize background services')
      throw error
    })
  }
  return initPromise
}

export async function ensureServicesInitialized(req, res, next) {
  if (req.method === 'OPTIONS') return next()
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
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service initializing or misconfigured.',
        detail: error?.message,
      },
    })
  }
}