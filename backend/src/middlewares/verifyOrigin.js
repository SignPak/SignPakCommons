import { env } from '../config/env.js'
import { forbidden } from '../utils/AppError.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF defence for cookie auth, on top of SameSite: browsers always send Origin on cross-site
 * writes, so a state-changing request from an origin we do not trust is refused.
 * Requests with no Origin header (curl, server-to-server, tests) are not browser CSRF vectors.
 */
export function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()
  const origin = req.headers.origin
  if (!origin || env.clientOrigins.includes(origin)) return next()
  return next(forbidden('This request came from an origin that is not allowed.'))
}
