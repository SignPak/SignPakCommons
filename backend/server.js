import app from './src/app.js'
import { connectDb, isDbReady } from './src/config/db.js'
import { env } from './src/config/env.js'
import { authService } from './src/services/authService.js'
import { storageService } from './src/services/storage/index.js'
import { logger } from './src/utils/logger.js'

/**
 * Startup work (DB, storage, admin bootstrap). The promise is cached so warm instances and
 * concurrent requests share one run, but a FAILED run is forgotten so the next request
 * retries instead of being stuck with the same rejected promise forever.
 */
let initPromise = null
function initServices() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!isDbReady()) await connectDb()
      await storageService.init()
      await authService.ensureAdminFromEnv()
    })().catch((error) => {
      initPromise = null
      throw error
    })
  }
  return initPromise
}

/**
 * When init fails, app.js (and its cors middleware) never runs, so the browser would report
 * a misleading "CORS header missing" instead of the real error. Send the CORS headers
 * ourselves so the frontend and the Network tab show the actual failure.
 */
function sendInitFailure(req, res, error) {
  const origin = req.headers.origin
  if (origin && env.clientOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  const body = { error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is starting up or misconfigured. Try again shortly.' } }
  // Opt-in only: set DEBUG_INIT_ERRORS=true while debugging, then remove it.
  if (process.env.DEBUG_INIT_ERRORS === 'true') body.error.detail = error?.message
  res.status(503).json(body)
}

// Vercel would call this exported function directly for every request; harmless if unused.
async function handler(req, res) {
  if (req.method === 'OPTIONS') return app(req, res)
  try {
    await initServices()
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize services')
    return sendInitFailure(req, res, error)
  }
  return app(req, res)
}

// Railway / any normal host: listen on a port like a regular Node server.
if (!process.env.VERCEL) {
  initServices()
    .then(() => {
      app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`))
    })
    .catch((error) => {
      logger.fatal({ err: error }, 'Failed to start server')
      process.exit(1)
    })
}

export default handler
