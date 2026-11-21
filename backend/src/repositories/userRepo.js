import { SIGNUP_TTL_MS, User } from '../models/User.js'

const LOCKOUT_FIELDS = '+failedLoginCount +lockedUntil'

export const userRepo = {
  findById: (id, { withPassword = false } = {}) => {
    const query = User.findById(id)
    if (withPassword) query.select('+passwordHash')
    return query
  },
  findByEmail: (email, { withPassword = false, withOtp = false, withLockout = false } = {}) => {
    const query = User.findOne({ email: email.trim().toLowerCase() })
    if (withPassword) query.select('+passwordHash')
    if (withLockout) query.select(LOCKOUT_FIELDS)
    if (withOtp) query.select('+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts +emailVerificationSentAt +passwordResetCodeHash +passwordResetExpiresAt +passwordResetAttempts +passwordResetSentAt')
    return query
  },
  findManyByIds: (ids) => User.find({ _id: { $in: ids } }),
  create: (data) => User.create(data),
  save: (doc) => doc.save(),
  list: ({ role, includeDeviceIds = false } = {}) => {
    const query = User.find(role ? { role } : {}).sort({ createdAt: 1 })
    return includeDeviceIds ? query.select('+lastDeviceId') : query
  },
  /** B2: accounts that finished sign-up. Unfinished sign-ups are not contributors. */
  countVerified: (role) => User.countDocuments({ role, emailVerified: true }),
  countActiveAdmins: () => User.countDocuments({ role: 'admin', status: 'active' }),
  remove: (id) => User.deleteOne({ _id: id }),

  /**
   * S2: counts one wrong password. A lock that has run out starts a fresh count. Reaching
   * `attempts` locks the account for `lockMs` and resets the count. The increment is atomic, so
   * simultaneous wrong guesses are all counted.
   */
  async recordFailedLogin(id, { attempts, lockMs, now = new Date() }) {
    await User.updateOne({ _id: id, lockedUntil: { $ne: null, $lte: now } }, { $set: { lockedUntil: null, failedLoginCount: 0 } })
    const user = await User.findOneAndUpdate({ _id: id }, { $inc: { failedLoginCount: 1 } }, { new: true }).select(LOCKOUT_FIELDS)
    if (!user || user.failedLoginCount < attempts) return { locked: false }
    const lockedUntil = new Date(now.getTime() + lockMs)
    await User.updateOne({ _id: id }, { $set: { lockedUntil, failedLoginCount: 0 } })
    return { locked: true, lockedUntil }
  },

  /** S2: a successful login, a password reset or a password change ends any lockout. */
  clearLoginFailures: (id) => User.updateOne(
    { _id: id, $or: [{ failedLoginCount: { $gt: 0 } }, { lockedUntil: { $ne: null } }] },
    { $set: { failedLoginCount: 0, lockedUntil: null } },
  ),

  /**
   * S9: unfinished sign-ups from before Phase 6 have no expiry; give them createdAt + 24 h so the
   * TTL index removes them. Idempotent: it only touches accounts that still have none.
   */
  backfillSignupExpiry: () => User.updateMany(
    { emailVerified: false, role: 'user', signupExpiresAt: null },
    [{ $set: { signupExpiresAt: { $add: ['$createdAt', SIGNUP_TTL_MS] } } }],
  ),
}
