import { createHmac } from 'node:crypto'
import { env } from '../config/env.js'
import { contactQuotaRepo } from '../repositories/contactQuotaRepo.js'
import { messageRepo } from '../repositories/messageRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { attemptCleanup } from '../utils/cleanup.js'
import { badRequest, conflict, forbidden, notFound, tooManyRequests } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { generateOtp, hashOtp, matchesOtp } from '../utils/otp.js'
import { emailService } from './email/index.js'
import { sendContactWeb3Forms } from './external/sendContactWeb3Forms.js'

export const DELETION_TOPIC = 'recording-deletion'
const CODE_PURPOSE = 'deletion-request'
/** Codes one deletion request can ever get, the first one included (S4). */
export const CODES_PER_REQUEST = 5

const utcDay = () => new Date().toISOString().slice(0, 10)
const topicLabels = {
  general: 'General inquiry',
  partnership: 'Partnership',
  [DELETION_TOPIC]: 'Request recording/data deletion',
}

const dailyLimitError = () => tooManyRequests('The contact form has reached its daily message limit. Try again tomorrow.')
const senderLimitError = () => tooManyRequests('You have already sent two deletion requests today. Try again tomorrow, or sign in to send one now.')
const invalidCode = () => badRequest('That code is invalid or has expired. Request a new code and try again.')
const resendTooSoon = () => tooManyRequests('Wait a minute before asking for a new code.')
const tooManyCodes = () => tooManyRequests('This request has had too many codes. Send a new request tomorrow.')

// S4: quota keys for an IP, a device or a recipient address. An HMAC rather than a plain hash,
// so the small IPv4 space (or a list of addresses) can't be hashed and looked up; the raw
// values are never stored.
export const contactSenderKey = (kind, value) => createHmac('sha256', env.JWT_SECRET).update(`contact-sender:${kind}:${value}`).digest('hex')
const senderKey = contactSenderKey

/**
 * Contact form (FR13.13), with the rules settled in FIX-PLAN section 0 and D4:
 * - signed-in contributors: one general/partnership message a day; deletion requests don't
 *   count and are verified at once;
 * - signed-out visitors: deletion requests only, two a day per IP and per device, verified by a
 *   six-digit code emailed to the account (if one exists);
 * - a site-wide cap (CONTACT_DAILY_LIMIT) on general/partnership messages, which answers 429;
 * - nothing here ever blocks a device or IP (S4).
 */
export const contactService = {
  deliver: sendContactWeb3Forms,

  async send({ topic, name, email, message }, { user, ip, deviceId }) {
    const normalizedEmail = email.trim().toLowerCase()
    const isDeletion = topic === DELETION_TOPIC

    if (user && normalizedEmail !== user.email) throw forbidden('Use the email address on your account to contact us.')
    if (!user && !isDeletion) throw forbidden('Sign in to send this contact topic.')

    const day = utcDay()
    const release = []
    let saved
    try {
      if (user && !isDeletion) {
        if (!await contactQuotaRepo.claimUser(user._id, day)) throw conflict('You can send one contact message per day.')
        release.push(() => contactQuotaRepo.releaseUser(user._id, day))
      }
      if (!user) {
        for (const key of [senderKey('ip', ip), deviceId && senderKey('device', deviceId)].filter(Boolean)) {
          if (!await contactQuotaRepo.claimSender(key, day, env.CONTACT_SENDER_DAILY_LIMIT)) throw senderLimitError()
          release.push(() => contactQuotaRepo.releaseSender(key, day))
        }
      }
      // Deletion requests are exempt from the site-wide cap, so nobody can use it up to stop
      // other people asking for their data to be deleted.
      if (!isDeletion) {
        if (!await contactQuotaRepo.claimDaily(day, env.CONTACT_DAILY_LIMIT)) throw dailyLimitError()
        release.push(() => contactQuotaRepo.releaseDaily(day))
      }

      const verified = isDeletion && Boolean(user)
      saved = await messageRepo.create({
        user: user?._id ?? null,
        topic,
        name,
        email: normalizedEmail,
        message,
        verified,
        // Every signed-out deletion request gets a send time, account or not, so the resend
        // wait looks the same whether or not the email belongs to someone.
        verificationSentAt: isDeletion && !user ? new Date() : null,
        // The first code counts toward CODES_PER_REQUEST, account or not.
        verificationSendCount: isDeletion && !user ? 1 : 0,
      })

      await this.deliver({
        name,
        email: normalizedEmail,
        topic: topicLabels[topic],
        message,
        // Shown in the forwarded subject, so the team can tell which deletion requests are proven.
        verification: isDeletion ? (verified ? 'verified' : 'verification pending') : null,
      })
    } catch (error) {
      if (saved) await attemptCleanup('remove unsent contact message', () => messageRepo.remove(saved._id))
      for (const undo of release.reverse()) await attemptCleanup('release contact quota', undo)
      throw error
    }

    const verificationRequired = isDeletion && !user
    // The code goes out in the background: the response is the same, in content and in time,
    // whether or not an account exists for this email (no account guessing).
    if (verificationRequired) void this.issueCode(saved._id).catch((error) => logger.error({ err: error }, 'Could not issue a deletion-request code'))
    return { received: true, id: String(saved._id), verificationRequired }
  },

  /**
   * Emails a fresh code for a signed-out deletion request, if an account uses its email and
   * that address has had fewer than CONTACT_CODE_EMAILS_PER_DAY code emails today (S4). Runs
   * after the response, so whether it sends never changes what the visitor sees.
   */
  async issueCode(messageId) {
    const request = await messageRepo.findForVerification(messageId)
    if (!request || request.verified) return false
    request.verificationSentAt = new Date()
    const account = await userRepo.findByEmail(request.email)
    const day = utcDay()
    const recipientKey = senderKey('email', request.email)
    if (!account || !await contactQuotaRepo.claimSender(recipientKey, day, env.CONTACT_CODE_EMAILS_PER_DAY)) {
      if (account) logger.warn({ messageId: String(request._id) }, 'Deletion-request code not sent: daily limit for this address reached')
      await messageRepo.save(request)
      return false
    }
    const code = generateOtp()
    request.verificationCodeHash = hashOtp(CODE_PURPOSE, request._id, code)
    request.verificationExpiresAt = new Date(Date.now() + env.AUTH_OTP_TTL_MINUTES * 60_000)
    request.verificationAttempts = 0
    await messageRepo.save(request)
    try {
      await emailService.sendOtp(request.email, code, CODE_PURPOSE)
    } catch (error) {
      await attemptCleanup('release code email quota', () => contactQuotaRepo.releaseSender(recipientKey, day))
      throw error
    }
    return true
  },

  /** D4: confirms a signed-out deletion request with the emailed code. */
  async verify(messageId, code) {
    const request = await messageRepo.findForVerification(messageId)
    if (!request || request.topic !== DELETION_TOPIC) throw invalidCode()
    if (request.verified) return { verified: true }

    const expired = !request.verificationCodeHash
      || (request.verificationExpiresAt?.getTime() ?? 0) < Date.now()
      || request.verificationAttempts >= env.AUTH_OTP_MAX_ATTEMPTS
    if (expired || !matchesOtp(request.verificationCodeHash, code, CODE_PURPOSE, request._id)) {
      request.verificationAttempts += 1
      if (request.verificationAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) {
        request.verificationCodeHash = null
        request.verificationExpiresAt = null
      }
      await messageRepo.save(request)
      throw invalidCode()
    }

    request.verified = true
    request.verificationCodeHash = null
    request.verificationExpiresAt = null
    request.verificationAttempts = 0
    await messageRepo.save(request)
    return { verified: true }
  },

  /** D4: sends a new code, at most once a minute. Same answer whether or not an account exists. */
  async resend(messageId) {
    const request = await messageRepo.findForVerification(messageId)
    if (!request || request.topic !== DELETION_TOPIC || request.verified || request.user) {
      throw badRequest('This request does not need a code.')
    }
    if ((request.verificationSendCount ?? 0) >= CODES_PER_REQUEST) throw tooManyCodes()
    // One atomic claim of the send time and the count, so two simultaneous resends can't both
    // pass. Counted whether or not an account exists, so the answers stay the same.
    const claimed = await messageRepo.claimResend(request._id, {
      sentBefore: new Date(Date.now() - env.AUTH_OTP_RESEND_SECONDS * 1000),
      maxSends: CODES_PER_REQUEST,
      now: new Date(),
    })
    if (!claimed) throw resendTooSoon()
    void this.issueCode(request._id).catch((error) => logger.error({ err: error }, 'Could not resend a deletion-request code'))
    return { message: 'If an account uses this email, a new code is on its way.' }
  },

  /** Admin inbox, newest first, optionally filtered by topic, status and verified (C3). */
  list({ limit, topic, status, verified } = {}) {
    const filter = {}
    if (topic) filter.topic = topic
    if (status) filter.status = status
    if (typeof verified === 'boolean') filter.verified = verified
    return messageRepo.list(filter, limit)
  },

  /** Admin: marks a message done or rejected (recording who and when), or reopens it. */
  async setStatus(id, status, admin) {
    const message = await messageRepo.findById(id)
    if (!message) throw notFound('That message does not exist.')
    message.status = status
    message.handledAt = status === 'open' ? null : new Date()
    message.handledBy = status === 'open' ? null : admin._id
    return messageRepo.save(message)
  },
}
