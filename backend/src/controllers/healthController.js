import { isDbReady } from '../config/db.js'
import { isStorageReady } from '../services/initialization.js'

/**
 * What the health check reports. Booleans and counters only: no driver names, paths, hosts or
 * error text, because this endpoint is public. "storage" means the configured drivers
 * initialized. For Google Drive that includes reading the root folder through the API, so the
 * OAuth token worked at startup; a token revoked later shows up on the next upload instead
 * (logged as invalid_grant, D3).
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
