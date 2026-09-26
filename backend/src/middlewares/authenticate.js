import { AUTH_COOKIE } from '../config/constants.js'
import { userRepo } from '../repositories/userRepo.js'
import { unauthorized } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { verifyToken } from '../utils/tokens.js'

async function loadUser(req) {
  const token = req.cookies?.[AUTH_COOKIE]
  const session = token && verifyToken(token)
  // The user is re-read on every request, so a deleted account or changed role takes effect immediately.
  const user = session ? await userRepo.findById(session.userId) : null
  return user && (user.authVersion || 0) === session.authVersion ? user : null
}

/** Requires a valid session. Sets req.user. */
export const authenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUser(req)
  if (!user) throw unauthorized()
  if (user.status === 'suspended') throw unauthorized('This account is suspended.')
  req.user = user
  next()
})

/** Attaches req.user when there is a valid session, but lets anonymous visitors through. */
export const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUser(req)
  req.user = user?.status === 'active' ? user : null
  next()
})
