/**
 * Graceful shutdown for SIGTERM/SIGINT (`docker stop` from Coolify, PM2 reload/stop, Ctrl+C).
 *
 * 1. Stop accepting new connections and drop idle keep-alive ones, so the new container (or
 *    the new process after `pm2 reload`) gets the traffic instead of a dying one.
 * 2. Let in-flight requests finish (an upload can take a while), then close MongoDB.
 * 3. Exit 0. If draining takes longer than `timeoutMs`, exit 1 rather than hang. Whoever sends
 *    SIGTERM waits longer than this before SIGKILL: Coolify's stop grace period (30 s by
 *    default; deploy/README.md) and PM2's kill_timeout (15 s, deploy/ecosystem.config.cjs).
 *
 * Dependencies are injected so the sequence can be unit-tested without a real server.
 */
export function createShutdown({ server, disconnectDb, logger, timeoutMs = 10_000, exit = process.exit }) {
  let started = false

  return async function shutdown(signal) {
    if (started) {
      logger.warn({ signal }, 'Shutdown already in progress; ignoring repeated signal')
      return
    }
    started = true
    logger.info({ signal }, 'Shutting down: no longer accepting connections')

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'Shutdown timed out; forcing exit')
      exit(1)
    }, timeoutMs)
    timer.unref?.()

    try {
      await new Promise((resolve, reject) => {
        server.close((error) => (error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()))
        server.closeIdleConnections?.()
      })
      await disconnectDb()
      clearTimeout(timer)
      logger.info('Shutdown complete')
      exit(0)
    } catch (error) {
      clearTimeout(timer)
      logger.error({ err: error }, 'Shutdown failed')
      exit(1)
    }
  }
}
