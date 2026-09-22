import app from './src/app.js'
import { connectDb, disconnectDb } from './src/config/db.js'
import { env } from './src/config/env.js'
import { authService } from './src/services/authService.js'
import { storageService } from './src/services/storage/index.js'
import { logger } from './src/utils/logger.js'

async function start() {
  await connectDb()
  await storageService.init()
  await authService.ensureAdminFromEnv()

  const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`))

  let closing = false
  const shutdown = async (signal) => {
    if (closing) return
    closing = true
    logger.info({ signal }, 'Shutting down')
    server.close(async () => {
      await disconnectDb()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref() // do not hang forever on open connections
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

process.on('unhandledRejection', (reason) => { logger.fatal({ err: reason }, 'Unhandled rejection'); process.exit(1) })

start().catch((error) => { logger.fatal({ err: error }, 'Failed to start'); process.exit(1) })
