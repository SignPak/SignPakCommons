import jwt from 'jsonwebtoken'
import { AUTH_COOKIE } from '../config/constants.js'
import { env } from '../config/env.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const signToken = (userId, authVersion = 0) => jwt.sign({ authVersion }, env.JWT_SECRET, { subject: String(userId), expiresIn: `${env.JWT_EXPIRES_DAYS}d`, algorithm: 'HS256' })

/** Returns the verified session claims, or null when the token is missing, expired or tampered with. */
export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] })
    return payload.sub ? { userId: payload.sub, authVersion: payload.authVersion ?? 0 } : null
  } catch {
    return null
  }
}

// httpOnly keeps the token out of reach of page scripts (XSS). SameSite blocks cross-site sends.
const cookieOptions = () => ({ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: env.COOKIE_SAMESITE, path: '/' })

export const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: env.JWT_EXPIRES_DAYS * DAY_MS })
export const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE, cookieOptions())

// Short-lived proof that someone just entered a valid email code. It is not a login: the account
// is only finished (and a session started) once the consent notice is accepted (see authService.completeSignup).
const CONSENT_TOKEN_MINUTES = 30
export const signConsentToken = (userId) => jwt.sign({ purpose: 'signup-consent' }, env.JWT_SECRET, { subject: String(userId), expiresIn: `${CONSENT_TOKEN_MINUTES}m`, algorithm: 'HS256' })
export function verifyConsentToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] })
    return payload.purpose === 'signup-consent' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}
