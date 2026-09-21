import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { tooManyRequests } from '../utils/AppError.js'

const limiter = ({ windowMs, limit, message }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => !env.RATE_LIMIT_ENABLED,
  handler: (req, res, next) => next(tooManyRequests(message)),
})

const MINUTE = 60 * 1000

export const apiLimiter = limiter({ windowMs: 15 * MINUTE, limit: 1000 })
// Slows down password guessing and account spam.
export const authLimiter = limiter({ windowMs: 15 * MINUTE, limit: 20, message: 'Too many attempts. Wait 15 minutes and try again.' })
export const contactLimiter = limiter({ windowMs: 60 * MINUTE, limit: 5, message: 'You have sent a few messages already. Try again later.' })
export const uploadLimiter = limiter({ windowMs: 15 * MINUTE, limit: 60, message: 'Too many uploads. Wait a few minutes and try again.' })
