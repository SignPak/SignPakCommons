import bcrypt from 'bcrypt'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { ROLES } from '../config/constants.js'
import { env } from '../config/env.js'
import { userRepo } from '../repositories/userRepo.js'
import { badRequest, conflict, unauthorized } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'
import { signToken } from '../utils/tokens.js'
import { sendOTPEmailBrevo } from './external/sendOTPBrevo.js'

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('signpak-timing-guard', env.BCRYPT_ROUNDS)

const emailTaken = () => conflict('An account with this email already exists. Log in instead.', { email: 'An account with this email already exists.' })
const invalidCode = () => badRequest('That code is invalid or has expired. Request a new code and try again.')
const otpHash = (purpose, userId, otp) => createHmac('sha256', env.JWT_SECRET).update(`${purpose}:${userId}:${otp}`).digest('hex')
const clearOtp = (user, purpose) => {
  const prefix = purpose === 'email-verification' ? 'emailVerification' : 'passwordReset'
  user[`${prefix}CodeHash`] = null
  user[`${prefix}ExpiresAt`] = null
  user[`${prefix}Attempts`] = 0
}
const matchesOtp = (stored, supplied, purpose, userId) => {
  if (!stored) return false
  const expected = Buffer.from(stored, 'hex')
  const actual = Buffer.from(otpHash(purpose, userId, supplied), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const authService = {
  async register({ email, firstName, surname, password }) {
    if (await userRepo.findByEmail(email)) throw emailTaken()
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    try {
      const user = await userRepo.create({ email, firstName, surname, passwordHash, role: ROLES.USER })
      const verificationEmailSent = await this.issueOtp(user, 'email-verification')
      return { email: user.email, verificationEmailSent }
    } catch (error) {
      if (isDuplicateKeyError(error)) throw emailTaken() // two signups racing for the same email
      throw error
    }
  },

  async issueOtp(user, purpose) {
    const prefix = purpose === 'email-verification' ? 'emailVerification' : 'passwordReset'
    const otp = String(100000 + randomInt(900000))
    user[`${prefix}CodeHash`] = otpHash(purpose, user._id, otp)
    user[`${prefix}ExpiresAt`] = new Date(Date.now() + env.AUTH_OTP_TTL_MINUTES * 60_000)
    user[`${prefix}Attempts`] = 0
    user[`${prefix}SentAt`] = new Date()
    await userRepo.save(user)
    try {
      await this.sendOTPEmail(user.email, otp, purpose)
      return true
    } catch (error) {
      logger.error({ err: error, purpose }, 'Could not deliver authentication code')
      clearOtp(user, purpose)
      user[`${prefix}SentAt`] = null
      await userRepo.save(user)
      return false
    }
  },

  sendOTPEmail: sendOTPEmailBrevo,

  async verifyEmail({ email, code }) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user || user.emailVerified) throw invalidCode()
    const expiry = user.emailVerificationExpiresAt?.getTime() || 0
    if (!user.emailVerificationCodeHash || expiry < Date.now() || user.emailVerificationAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) {
      clearOtp(user, 'email-verification')
      await userRepo.save(user)
      throw invalidCode()
    }
    if (!matchesOtp(user.emailVerificationCodeHash, code, 'email-verification', user._id)) {
      user.emailVerificationAttempts += 1
      if (user.emailVerificationAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) clearOtp(user, 'email-verification')
      await userRepo.save(user)
      throw invalidCode()
    }
    user.emailVerified = true
    clearOtp(user, 'email-verification')
    await userRepo.save(user)
    return { user, token: signToken(user.id, user.authVersion || 0) }
  },

  async resendVerification(email) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user || user.emailVerified) return false
    const sentAt = user.emailVerificationSentAt?.getTime() || 0
    if (Date.now() - sentAt < env.AUTH_OTP_RESEND_SECONDS * 1000) return false
    return this.issueOtp(user, 'email-verification')
  },

  async requestPasswordReset(email) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user) return false
    const sentAt = user.passwordResetSentAt?.getTime() || 0
    if (Date.now() - sentAt < env.AUTH_OTP_RESEND_SECONDS * 1000) return false
    return this.issueOtp(user, 'password-reset')
  },

  async resetPassword({ email, code, password }) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user) throw invalidCode()
    const expiry = user.passwordResetExpiresAt?.getTime() || 0
    if (!user.passwordResetCodeHash || expiry < Date.now() || user.passwordResetAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) {
      clearOtp(user, 'password-reset')
      await userRepo.save(user)
      throw invalidCode()
    }
    if (!matchesOtp(user.passwordResetCodeHash, code, 'password-reset', user._id)) {
      user.passwordResetAttempts += 1
      if (user.passwordResetAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) clearOtp(user, 'password-reset')
      await userRepo.save(user)
      throw invalidCode()
    }
    user.passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    user.authVersion = (user.authVersion || 0) + 1
    clearOtp(user, 'password-reset')
    await userRepo.save(user)
  },

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email, { withPassword: true })
    const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
    if (!user || !matches) throw unauthorized('That email and password do not match. Check them and try again.')
    if (user.status === 'suspended') throw unauthorized('This account is suspended.')
    if (!user.emailVerified) throw unauthorized('Verify your email address before logging in.')
    return { user, token: signToken(user.id, user.authVersion || 0) }
  },

  async recordDevice(user, deviceId) {
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(deviceId || '')) return user
    user.lastDeviceId = deviceId
    return userRepo.save(user)
  },

  /** Admin accounts come from environment variables, never from the signup form. Safe to run on every boot. */
  async ensureAdminFromEnv() {
    const existing = await userRepo.findByEmail(env.ADMIN_EMAIL)
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS)
      await userRepo.create({ email: env.ADMIN_EMAIL, firstName: env.ADMIN_FIRST_NAME, surname: env.ADMIN_SURNAME, passwordHash, role: ROLES.ADMIN, emailVerified: true })
      logger.info({ email: env.ADMIN_EMAIL }, 'Admin account created from environment')
    } else if (existing.role !== ROLES.ADMIN || !existing.emailVerified) {
      existing.role = ROLES.ADMIN
      existing.emailVerified = true
      await userRepo.save(existing)
      logger.info({ email: env.ADMIN_EMAIL }, 'Existing account promoted or verified as admin from environment')
    }
    // An existing admin's password is intentionally left alone; changing ADMIN_PASSWORD later does not reset it.
  },
}
