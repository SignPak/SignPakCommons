import { SIGNUP_TTL_MS, User } from '../models/User.js'

const LOCKOUT_FIELDS = '+failedLoginCount +lockedUntil'
// B7: a search term is matched literally, never as a regular expression.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const OTP_FIELDS = '+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts +emailVerificationSentAt +passwordResetCodeHash +passwordResetExpiresAt +passwordResetAttempts +passwordResetSentAt'

/** B3: matches an authVersion exactly; version 0 also matches an account that has no authVersion field. */
export const versionMatch = (version) => (version ? version : { $in: [0, null] })
// B3: an unfinished user sign-up that is still at the version the caller checked.
const pendingAt = (id, version) => ({ _id: id, emailVerified: false, role: 'user', authVersion: versionMatch(version) })

export const userRepo = {
  findById: (id, { withPassword = false, withLockout = false } = {}) => {
    const query = User.findById(id)
    if (withPassword) query.select('+passwordHash')
    if (withLockout) query.select(LOCKOUT_FIELDS)
    return query
  },
  findByEmail: (email, { withPassword = false, withOtp = false, withLockout = false } = {}) => {
    const query = User.findOne({ email: email.trim().toLowerCase() })
    if (withPassword) query.select('+passwordHash')
    if (withLockout) query.select(LOCKOUT_FIELDS)
    if (withOtp) query.select(OTP_FIELDS)
    return query
  },
  findManyByIds: (ids) => User.find({ _id: { $in: ids } }),
  /**
   * B7: one page of accounts, oldest first. `q` matches the start of the first name, surname or
   * email, case-insensitively and literally (regex characters are escaped).
   */
  async page({ role, q, limit, cursor, includeDeviceIds = false }) {
    const filter = {}
    if (role) filter.role = role
    if (q) {
      const prefix = new RegExp(`^${escapeRegex(q)}`, 'i')
      filter.$or = [{ firstName: prefix }, { surname: prefix }, { email: prefix }]
    }
    const pageFilter = cursor ? { ...filter, _id: { $gt: cursor } } : filter
    const query = User.find(pageFilter).sort({ _id: 1 }).limit(limit + 1)
    if (includeDeviceIds) query.select('+lastDeviceId')
    const [rows, total] = await Promise.all([query, User.countDocuments(filter)])
    const items = rows.slice(0, limit)
    return { items, total, nextCursor: rows.length > limit ? String(items.at(-1)._id) : null }
  },
  /** S7: the accounts with these (lowercased) emails. */
  findByEmails: (emails) => User.find({ email: { $in: emails } }),
  listAdmins: () => User.find({ role: 'admin' }).sort({ createdAt: 1 }),
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

  /*
   * B3: a re-signup and a consent or decline for the same unfinished sign-up are each one
   * conditional write on emailVerified and authVersion, so only one of them can win. Each
   * returns null (or deletedCount 0) when the account was finished or changed meanwhile.
   */
  /** Re-signup: new details, and the version bump voids every consent token issued before it. */
  updatePendingSignup: (id, expectedVersion, fields) => User.findOneAndUpdate(
    pendingAt(id, expectedVersion),
    { $set: fields, $inc: { authVersion: 1 } },
    { new: true },
  ).select(OTP_FIELDS),
  /** Consent: finishes the sign-up the token was issued for. */
  completePendingSignup: (id, version, { consent }) => User.findOneAndUpdate(
    pendingAt(id, version),
    { $set: { emailVerified: true, consent, signupExpiresAt: null } },
    { new: true },
  ),
  /** Decline: removes the sign-up the token was issued for. */
  removePendingSignup: (id, version) => User.deleteOne(pendingAt(id, version)),

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
