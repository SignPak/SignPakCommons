import app from './src/app.js'
import { disconnectDb } from './src/config/db.js'
import { env } from './src/config/env.js'
import { startupWarnings } from './src/config/startupChecks.js'
import { initServices } from './src/services/initialization.js'
import { createShutdown } from './src/utils/gracefulShutdown.js'
import { logger } from './src/utils/logger.js'

// Standalone Node process, kept alive by PM2 behind Nginx (deploy/). See deploy/README.md.
for (const warning of startupWarnings(env)) logger.warn(warning)

// HOST defaults to 127.0.0.1 in production: Nginx is the only client (S3).
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT }, 'API server listening')
})

// Start connecting right away instead of waiting for the first request.
initServices().catch((error) => {
  logger.error({ err: error }, 'Service initialization failed on boot; requests will retry it')
})

const shutdown = createShutdown({ server, disconnectDb, logger })
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
