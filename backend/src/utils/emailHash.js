import { createHmac } from 'node:crypto'
import { env } from '../config/env.js'

/**
 * C3: the only form in which deletion records keep an email address. An HMAC keyed with
 * EMAIL_HASH_SECRET over the trimmed, lowercased address, so the same person always matches but
 * a stored hash can't be reversed by hashing a list of likely addresses. DeletionLog,
 * DeletedAccount and the admin deletion lookup all use this one function.
 */
export function hashEmail(email) {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalized) throw new TypeError('hashEmail needs an email address.')
  return createHmac('sha256', env.EMAIL_HASH_SECRET).update(`email:${normalized}`).digest('hex')
}
