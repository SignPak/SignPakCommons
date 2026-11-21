import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * One-time six-digit codes, shared by sign-up/password reset (authService) and deletion-request
 * verification (contactService). Only a keyed hash is stored: an HMAC with JWT_SECRET over
 * purpose, subject and code, so a code for one purpose or record can never be used for another.
 */

/** A uniformly random six-digit code, 100000-999999. */
export const generateOtp = () => String(100000 + randomInt(900000))

export const hashOtp = (purpose, subjectId, code) =>
  createHmac('sha256', env.JWT_SECRET).update(`${purpose}:${subjectId}:${code}`).digest('hex')

/** Timing-safe comparison of a supplied code against a stored hash. */
export function matchesOtp(stored, supplied, purpose, subjectId) {
  if (!stored) return false
  const expected = Buffer.from(stored, 'hex')
  const actual = Buffer.from(hashOtp(purpose, subjectId, supplied), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
