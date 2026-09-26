import { accessRestrictionService } from '../services/accessRestrictionService.js'
import { forbidden } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const enforceAccessRestrictions = asyncHandler(async (req, res, next) => {
  // Admin routes stay reachable so an administrator can remove a mistaken restriction.
  if (req.path === '/admin' || req.path.startsWith('/admin/')) return next()
  const deviceId = req.get('X-Device-ID')?.slice(0, 128)
  if (await accessRestrictionService.isRequestRestricted(req.ip, deviceId)) {
    throw forbidden('Access from this network or device has been restricted.')
  }
  next()
})