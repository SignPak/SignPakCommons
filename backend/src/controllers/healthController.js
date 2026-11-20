import { isDbReady } from '../config/db.js'
import { isStorageReady } from '../services/initialization.js'

/**
 * What the health check reports. Booleans and counters only: no driver names, paths, hosts or
 * error text, because this endpoint is public. "storage" means the configured drivers
 * initialized; it does not prove a Google Drive token is still valid.
 */
export function buildHealth({ database, storage, uptimeSeconds }) {
  const healthy = database && storage
  return {
    status: healthy ? 200 : 503,
    body: {
      status: healthy ? 'ok' : 'degraded',
      database: database ? 'connected' : 'disconnected',
      storage,
      uptime: Math.round(uptimeSeconds),
    },
  }
}

export const healthController = {
  get(req, res) {
    const { status, body } = buildHealth({
      database: isDbReady(),
      storage: isStorageReady(),
      uptimeSeconds: process.uptime(),
    })
    res.status(status).json({ data: body })
  },
}
