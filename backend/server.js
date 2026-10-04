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
 * When init fails, send CORS headers and a 503 response instead of a proxy 502.
 */
function sendInitFailure(req, res, error) {
  const origin = req.headers.origin
  if (origin && env.clientOrigins?.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  const body = { 
    error: { 
      code: 'SERVICE_UNAVAILABLE', 
      message: 'The service is starting up or misconfigured. Try again shortly.' 
    } 
  }
  // Set DEBUG_INIT_ERRORS=true in Railway variables to see full error messages in HTTP responses
  if (process.env.DEBUG_INIT_ERRORS === 'true') {
    body.error.detail = error?.message
  }
  res.status(503).json(body)
}

// 1. Guard all routes with initServices() middleware
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next()
  try {
    await initServices()
    next()
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize services')
    return sendInitFailure(req, res, error)
  }
})

// Vercel serverless handler export
async function handler(req, res) {
  return app(req, res)
}

// 2. Railway / standalone host: Start app.listen IMMEDIATELY so port 5000 is open right away
if (!process.env.VERCEL) {
  const PORT = env.PORT || process.env.PORT || 5000

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`API listening on http://0.0.0.0:${PORT}`)
  })

  // Start initialization in background on container boot
  initServices().catch((error) => {
    logger.fatal({ err: error }, 'Background initialization failed on boot')
  })
}

export default handler
