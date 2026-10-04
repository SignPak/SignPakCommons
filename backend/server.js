import app from './src/app.js'
import { connectDb, isDbReady } from './src/config/db.js'
import { env } from './src/config/env.js'
import { authService } from './src/services/authService.js'
import { storageService } from './src/services/storage/index.js'
import { logger } from './src/utils/logger.js'

/**
 * Startup work (DB, storage, admin bootstrap).
 */
let initPromise = null

function initServices() {
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

// Attach init guard at top of application stack in src/app.js if possible,
// or prepend middleware to router stack:
app._router?.stack?.unshift({
  path: '',
  route: null,
  handle: async (req, res, next) => {
    if (req.method === 'OPTIONS') return next()
    try {
      await initServices()
      next()
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
  },
})

// Vercel serverless handler export
async function handler(req, res) {
  return app(req, res)
}

// Standalone execution (Railway / Docker / Local Node)
// Ignore process.env.VERCEL if running via direct `node server.js` command
const PORT = env.PORT || process.env.PORT || 5000

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`)
  console.log(`API SERVER LISTENING ON http://0.0.0.0:${PORT}`)
  console.log(`==================================================`)
})

// Trigger background initialization immediately after port binding
initServices().catch((error) => {
  console.error('[BOOT ERROR] Service initialization failed on boot:', error.message)
})

export default handler
