import bcrypt from 'bcrypt'
import { CONSENT_VERSION, ROLES } from '../config/constants.js'
import { env } from '../config/env.js'
import { SIGNUP_TTL_MS } from '../models/User.js'
import { userRepo } from '../repositories/userRepo.js'
import { AppError, badRequest, conflict, unauthorized, validationError } from '../utils/AppError.js'
import { hashEmail } from '../utils/emailHash.js'
import { logger } from '../utils/logger.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'
import { generateOtp, hashOtp as otpHash, matchesOtp } from '../utils/otp.js'
import { signConsentToken, signToken, verifyConsentToken } from '../utils/tokens.js'
import { auditService } from './auditService.js'
import { emailService } from './email/index.js'

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('signpak-timing-guard', env.BCRYPT_ROUNDS)

const emailTaken = () => conflict('An account with this email already exists. Log in instead.', { email: 'An account with this email already exists.' })
const signupExpired = () => badRequest('This sign-up step has expired. Verify your email again to continue.')
const invalidCode = () => badRequest('That code is invalid or has expired. Request a new code and try again.')
const wrongCredentials = () => unauthorized('That email and password do not match. Check them and try again.')
// S2 / SE-4. 429 with its own code, so a client can tell a lockout from a wrong password.
const accountLocked = () => new AppError(429, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${env.AUTH_LOCKOUT_MINUTES} minutes.`)
// S7 (FIX-PLAN Phase 7 item 4): one info line per login attempt, with the email's keyed hash
// and never the password or the email itself.
const logLogin = (email, ip, outcome, extra = {}) => {
  let emailHash = null
  try { emailHash = hashEmail(email) } catch { /* no usable email: logged without a hash */ }
  logger.info({ event: 'login', emailHash, outcome, ip: ip ?? null, ...extra }, 'Login attempt')
}
const clearOtp = (user, purpose) => {
  const prefix = purpose === 'email-verification' ? 'emailVerification' : 'passwordReset'
  user[`${prefix}CodeHash`] = null
  user[`${prefix}ExpiresAt`] = null
  user[`${prefix}Attempts`] = 0
}

export const authService = {
  /**
   * New sign-up, or B3: signing up again with an email whose sign-up was never finished. That
   * updates the names and password, restarts the 24-hour expiry (S9) and resends the code
   * (at most once per AUTH_OTP_RESEND_SECONDS), with the same answer as a new sign-up. The
   * password is asked for again with the code (verifyEmail), so whoever finishes the sign-up
   * is the person who chose it.
   *
   * The update is conditional on the account still being unfinished and at the version read
   * here: if a consent lands while the password is being hashed, the consent wins and this
   * answers 409 without touching the account.
   */
  async register({ email, firstName, surname, password }) {
    const existing = await userRepo.findByEmail(email, { withOtp: true })
    if (existing && (existing.emailVerified || existing.role !== ROLES.USER)) throw emailTaken()
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    const signupExpiresAt = new Date(Date.now() + SIGNUP_TTL_MS)
    if (existing) {
      // B3: the update bumps the version, which voids any consent token handed out before it.
      const updated = await userRepo.updatePendingSignup(existing._id, existing.authVersion || 0, { firstName, surname, passwordHash, signupExpiresAt })
      if (!updated) throw emailTaken() // finished (or signed up again) while the password was hashing
      const sentAt = updated.emailVerificationSentAt?.getTime() || 0
      if (updated.emailVerificationCodeHash && Date.now() - sentAt < env.AUTH_OTP_RESEND_SECONDS * 1000) {
        return { email: updated.email, verificationEmailSent: true } // the code sent a moment ago still works
      }
      return { email: updated.email, verificationEmailSent: await this.issueOtp(updated, 'email-verification') }
    }
    try {
      const user = await userRepo.create({ email, firstName, surname, passwordHash, role: ROLES.USER, emailVerified: false, signupExpiresAt })
      const verificationEmailSent = await this.issueOtp(user, 'email-verification')
      return { email: user.email, verificationEmailSent }
    } catch (error) {
      if (isDuplicateKeyError(error)) throw emailTaken() // two signups racing for the same email
      throw error
    }
  },

  async issueOtp(user, purpose) {
    const prefix = purpose === 'email-verification' ? 'emailVerification' : 'passwordReset'
    const otp = generateOtp()
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

  // Goes through the configured email driver (EMAIL_DRIVER): Brevo in production, capture in tests.
  sendOTPEmail: (email, code, purpose) => emailService.sendOtp(email, code, purpose),

  async verifyEmail({ email, code, password }) {
    const user = await userRepo.findByEmail(email, { withOtp: true, withPassword: true })
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
    // B3: the code proves the email; the password proves it is the person who set it. A wrong
    // password uses up an attempt like a wrong code, and the code stays valid until then.
    if (!await bcrypt.compare(password, user.passwordHash)) {
      user.emailVerificationAttempts += 1
      if (user.emailVerificationAttempts >= env.AUTH_OTP_MAX_ATTEMPTS) clearOtp(user, 'email-verification')
      await userRepo.save(user)
      throw validationError({ password: 'That is not the password you chose when signing up. Forgotten it? Sign up again with a new one.' })
    }
    // A correct code only proves the email address. The account is not created (verified, able to log in
    // or contribute) until the contributor accepts the consent notice: see completeSignup.
    clearOtp(user, 'email-verification')
    await userRepo.save(user)
    return { consentToken: signConsentToken(user.id, user.authVersion || 0) }
  },

  /**
   * The unfinished sign-up a consent token belongs to. The token must still match the account's
   * version (B3): after a re-signup only a token from the newest verification can finish or
   * cancel it. That covers completeSignup and declineSignup.
   *
   * This read is only a fast check: a re-signup can still land after it. What decides is the
   * conditional write in completeSignup and declineSignup, which matches only an account that is
   * still unfinished and still at the token's version.
   */
  async pendingSignup(consentToken) {
    const claims = verifyConsentToken(consentToken)
    const user = claims ? await userRepo.findById(claims.userId) : null
    if (!user || user.emailVerified || user.role !== ROLES.USER || (user.authVersion || 0) !== claims.v) throw signupExpired()
    return user
  },

  /** Finishes sign-up: records the consent (date, time, version), activates the account and starts a session. */
  async completeSignup({ consentToken, version }) {
    if (version !== CONSENT_VERSION) throw conflict('The consent notice was updated. Reload the page and read the current version.')
    const pending = await this.pendingSignup(consentToken)
    // B3: only if it is still the sign-up the token was issued for. Clears the S9 expiry too.
    const user = await userRepo.completePendingSignup(pending._id, pending.authVersion || 0, { consent: { acceptedAt: new Date(), version: CONSENT_VERSION } })
    if (!user) throw signupExpired()
    return { user, token: signToken(user.id, user.authVersion || 0) }
  },

  /** Declining consent means no account: the unfinished sign-up is removed. */
  async declineSignup({ consentToken }) {
    const pending = await this.pendingSignup(consentToken)
    const { deletedCount } = await userRepo.removePendingSignup(pending._id, pending.authVersion || 0)
    if (!deletedCount) throw signupExpired() // B3: signed up again (or finished) meanwhile
  },

  /**
   * Resend and password-reset both used to `await issueOtp(...)`, which calls out to Brevo.
   * An unknown email returned instantly (no user, nothing to await); a known email waited on
   * the network call. That timing gap let someone enumerate registered emails just by timing
   * the response, even though the response body is identical either way (see authController,
   * which always returns the same generic message). Firing the OTP issuance in the background
   * closes that gap: both cases now return at roughly the same speed.
   */
  async resendVerification(email) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user || user.emailVerified) return false
    const sentAt = user.emailVerificationSentAt?.getTime() || 0
    if (Date.now() - sentAt < env.AUTH_OTP_RESEND_SECONDS * 1000) return false
    void this.issueOtp(user, 'email-verification').catch((error) => logger.error({ err: error }, 'Could not issue verification OTP'))
    return true
  },

  async requestPasswordReset(email) {
    const user = await userRepo.findByEmail(email, { withOtp: true })
    if (!user) return false
    const sentAt = user.passwordResetSentAt?.getTime() || 0
    if (Date.now() - sentAt < env.AUTH_OTP_RESEND_SECONDS * 1000) return false
    void this.issueOtp(user, 'password-reset').catch((error) => logger.error({ err: error }, 'Could not issue password reset OTP'))
    return true
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
    await userRepo.clearLoginFailures(user._id) // S2: a reset also ends a lockout
  },

  /**
   * Password change while logged in. Every other session ends (authVersion), and the caller
   * gets a fresh token so this device stays signed in.
   */
  async changePassword(user, { currentPassword, password }) {
    const account = await userRepo.findById(user._id, { withPassword: true, withLockout: true })
    if (!account) throw unauthorized('Your current password is not correct.')
    const matches = await bcrypt.compare(currentPassword, account.passwordHash)
    // S2: a wrong current password counts like a wrong login password, and a locked account
    // can't change its password until the lock passes. The current session is not ended.
    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) throw accountLocked()
    if (!matches) {
      const { locked } = await userRepo.recordFailedLogin(account._id, { attempts: env.AUTH_LOCKOUT_ATTEMPTS, lockMs: env.AUTH_LOCKOUT_MINUTES * 60_000 })
      throw locked ? accountLocked() : unauthorized('Your current password is not correct.')
    }
    if (await bcrypt.compare(password, account.passwordHash)) throw validationError({ password: 'Choose a password different from your current one.' })
    account.passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    account.authVersion = (account.authVersion || 0) + 1
    await userRepo.save(account)
    await userRepo.clearLoginFailures(account._id)
    return signToken(account.id, account.authVersion)
  },

  /** S6: logging out ends every session of the account, on every device. */
  async logout(user) {
    if (!user) return
    user.authVersion = (user.authVersion || 0) + 1
    await userRepo.save(user)
  },

  /**
   * S2 / SE-4: AUTH_LOCKOUT_ATTEMPTS wrong passwords lock the account for AUTH_LOCKOUT_MINUTES.
   * bcrypt always runs (DUMMY_HASH for an unknown email), so timing does not show whether the
   * email exists. While locked, even the right password is refused.
   */
  async login({ email, password }, { ip } = {}) {
    const user = await userRepo.findByEmail(email, { withPassword: true, withLockout: true })
    const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
    const refuse = (outcome, error, extra) => { logLogin(email, ip, outcome, extra); throw error }
    if (!user) refuse('unknown-email', wrongCredentials())
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) refuse('locked', accountLocked())
    if (!matches) {
      const { locked } = await userRepo.recordFailedLogin(user._id, { attempts: env.AUTH_LOCKOUT_ATTEMPTS, lockMs: env.AUTH_LOCKOUT_MINUTES * 60_000 })
      refuse('wrong-password', locked ? accountLocked() : wrongCredentials(), { locked })
    }
    if (user.status === 'suspended') refuse('suspended', unauthorized('This account is suspended.'))
    if (!user.emailVerified) refuse('unverified', unauthorized('Verify your email address before logging in.'))
    if (user.failedLoginCount || user.lockedUntil) await userRepo.clearLoginFailures(user._id)
    logLogin(email, ip, 'success')
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
    await this.syncAdmins()
  },

  /**
   * S7 / D5: the admin list is ADMIN_EMAIL plus ADMIN_EMAILS. Verified accounts on it become
   * admins; admins not on it go back to normal users, one at a time and never the last active
   * admin. Each change is logged and written to the activity log with the system as actor.
   * Runs at startup, so a team member is promoted on the first restart after finishing sign-up.
   */
  async syncAdmins({ primary = env.ADMIN_EMAIL, emails = env.adminEmails } = {}) {
    const listed = new Set([primary, ...emails].map((email) => email.trim().toLowerCase()))
    const result = { promoted: [], demoted: [], kept: [] }

    for (const user of await userRepo.findByEmails([...listed])) {
      if (user.role !== ROLES.USER || !user.emailVerified) continue
      user.role = ROLES.ADMIN
      await userRepo.save(user)
      result.promoted.push(user.id)
      logger.info({ userId: user.id }, 'Account promoted to admin from the admin list')
      await auditService.record({ actor: null, action: 'admin.promote', targetType: 'user', targetId: user.id })
    }

    const admins = await userRepo.listAdmins()
    let active = admins.filter((admin) => admin.status === 'active').length
    for (const admin of admins) {
      if (listed.has(admin.email)) continue
      if (admin.status === 'active' && active <= 1) {
        result.kept.push(admin.id)
        logger.warn({ userId: admin.id }, 'Admin not on the admin list was kept: it is the last active admin')
        continue
      }
      admin.role = ROLES.USER
      await userRepo.save(admin)
      if (admin.status === 'active') active -= 1
      result.demoted.push(admin.id)
      logger.info({ userId: admin.id }, 'Admin not on the admin list went back to a normal account')
      await auditService.record({ actor: null, action: 'admin.demote', targetType: 'user', targetId: admin.id })
    }
    return result
  },
}
