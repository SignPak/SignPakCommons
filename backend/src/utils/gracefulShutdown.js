/**
 * Graceful shutdown for SIGTERM/SIGINT (PM2 reload/stop, systemd, Ctrl+C).
 *
 * 1. Stop accepting new connections and drop idle keep-alive ones, so `pm2 reload` hands
 *    traffic to the new process instead of to a dying one.
 * 2. Let in-flight requests finish (an upload can take a while), then close MongoDB.
 * 3. Exit 0. If draining takes longer than `timeoutMs`, exit 1 rather than hang; PM2's
 *    kill_timeout (deploy/ecosystem.config.cjs) is set above this so PM2 never has to SIGKILL
 *    a process that is still closing cleanly.
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
