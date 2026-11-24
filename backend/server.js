import fs from 'node:fs'
import app from './src/app.js'
import { disconnectDb } from './src/config/db.js'
import { env } from './src/config/env.js'
import { startupWarnings } from './src/config/startupChecks.js'
import { initServices } from './src/services/initialization.js'
import { createShutdown } from './src/utils/gracefulShutdown.js'
import { startHttpServer } from './src/utils/httpServer.js'
import { logger } from './src/utils/logger.js'

// Standalone Node process. In production it runs as a Docker container under Coolify, behind
// Traefik (backend/Dockerfile); on a bare server it runs under PM2 behind Nginx. See
// deploy/README.md for both.
const inContainer = fs.existsSync('/.dockerenv')
for (const warning of startupWarnings(env, { inContainer })) logger.warn(warning)

// HOST defaults to 127.0.0.1 in production: on a bare server Nginx is the only client (S3).
// Under Coolify it is set to 0.0.0.0, with no host port published, so only Traefik reaches it.
const server = startHttpServer(app, { port: env.PORT, host: env.HOST, requestTimeoutMs: env.REQUEST_TIMEOUT_MS }, () => {
  logger.info({ host: env.HOST, port: env.PORT, requestTimeoutMs: env.REQUEST_TIMEOUT_MS }, 'API server listening')
})

// Start connecting right away instead of waiting for the first request.
initServices().catch((error) => {
  logger.error({ err: error }, 'Service initialization failed on boot; requests will retry it')
})

const shutdown = createShutdown({ server, disconnectDb, logger })
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
