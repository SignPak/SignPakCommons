import jwt from 'jsonwebtoken'
import { AUTH_COOKIE } from '../config/constants.js'
import { env } from '../config/env.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const signToken = (userId) => jwt.sign({}, env.JWT_SECRET, { subject: String(userId), expiresIn: `${env.JWT_EXPIRES_DAYS}d`, algorithm: 'HS256' })

/** Returns the user id, or null when the token is missing, expired or tampered with. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }).sub || null
  } catch {
    return null
  }
}

// httpOnly keeps the token out of reach of page scripts (XSS). SameSite blocks cross-site sends.
const cookieOptions = () => ({ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, path: '/' })

export const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: env.JWT_EXPIRES_DAYS * DAY_MS })
export const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE, cookieOptions())
