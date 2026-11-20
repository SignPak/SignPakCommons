import { isDbReady } from '../config/db.js'
import { accessRestrictionService } from '../services/accessRestrictionService.js'
import { forbidden } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const enforceAccessRestrictions = asyncHandler(async (req, res, next) => {
  // Admin routes stay reachable so an administrator can remove a mistaken restriction.
  if (req.path === '/admin' || req.path.startsWith('/admin/')) return next()
  // Restrictions live in MongoDB. When it is unreachable the lookup would hang for Mongoose's
  // buffer timeout and turn the health check into a slow 500; the health check exists to say
  // "the database is down", returns booleans only, and there are no restriction records to
  // enforce without a database, so it is answered directly. Every other route still checks.
  if (req.path === '/health' && !isDbReady()) return next()
  const deviceId = req.get('X-Device-ID')?.slice(0, 128)
  if (await accessRestrictionService.isRequestRestricted(req.ip, deviceId)) {
    throw forbidden('Access from this network or device has been restricted.')
  }
  next()
})
