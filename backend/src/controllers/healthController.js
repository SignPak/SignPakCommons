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

/**
 * Phase 11 (D1): the container's health check (backend/Dockerfile). Traefik stops routing to an
 * unhealthy container, so this fails (503) only when MongoDB is down: without the database
 * nothing works. A storage failure (usually the Google Drive token, D3) is reported here as
 * storage: false and status "degraded" but answers 200, so login and browsing stay up while
 * uploads fail. /health keeps the strict answer for people and deploy.sh.
 */
export function buildLiveHealth({ database, storage, uptimeSeconds }) {
  return {
    status: database ? 200 : 503,
    body: {
      status: database && storage ? 'ok' : 'degraded',
      database: database ? 'connected' : 'disconnected',
      storage,
      uptime: Math.round(uptimeSeconds),
    },
  }
}

const respond = (build) => (req, res) => {
  const { status, body } = build({
    database: isDbReady(),
    storage: isStorageReady(),
    uptimeSeconds: process.uptime(),
  })
  res.status(status).json({ data: body })
}

export const healthController = {
  get: respond(buildHealth),
  live: respond(buildLiveHealth),
}
