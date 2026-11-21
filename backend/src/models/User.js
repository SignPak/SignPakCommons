import mongoose from 'mongoose'
import { ROLES, ROLE_LIST } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  surname: { type: String, required: true, trim: true, maxlength: 60 },
  passwordHash: { type: String, required: true, select: false },
  authVersion: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: true },
  emailVerificationCodeHash: { type: String, default: null, select: false },
  emailVerificationExpiresAt: { type: Date, default: null, select: false },
  emailVerificationAttempts: { type: Number, default: 0, select: false },
  emailVerificationSentAt: { type: Date, default: null, select: false },
  passwordResetCodeHash: { type: String, default: null, select: false },
  passwordResetExpiresAt: { type: Date, default: null, select: false },
  passwordResetAttempts: { type: Number, default: 0, select: false },
  passwordResetSentAt: { type: Date, default: null, select: false },
  // S2: consecutive wrong passwords, and the time the account is locked until (SE-4).
  failedLoginCount: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, default: null, select: false },
  // S9: when an unfinished sign-up is deleted (see the TTL index below). Restarted by a
  // re-signup (B3) and cleared once the sign-up is completed.
  signupExpiresAt: { type: Date, default: null, select: false },
  role: { type: String, enum: ROLE_LIST, default: ROLES.USER },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  statusReason: { type: String, trim: true, maxlength: 500, default: '' },
  lastDeviceId: { type: String, select: false, default: null },
  // OR-19: the contributor accepts the data-use notice right after verifying their email.
  consent: {
    acceptedAt: { type: Date, default: null },
    version: { type: String, default: null },
  },
  connections: {
    github: { type: String, default: null },
    linkedin: { type: String, default: null },
  },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => {
    for (const key of ['passwordHash', 'authVersion', 'updatedAt', 'lastDeviceId', 'emailVerificationCodeHash', 'emailVerificationExpiresAt', 'emailVerificationAttempts', 'emailVerificationSentAt', 'passwordResetCodeHash', 'passwordResetExpiresAt', 'passwordResetAttempts', 'passwordResetSentAt', 'failedLoginCount', 'lockedUntil', 'signupExpiresAt']) delete ret[key]
    return ret
  }),
})

/** S9: how long an unfinished sign-up keeps its email address. */
export const SIGNUP_TTL_MS = 24 * 60 * 60 * 1000

/**
 * S9: MongoDB deletes an unfinished sign-up once `signupExpiresAt` passes. The partial filter
 * means only unverified contributor accounts can ever match: an admin (role 'admin', and
 * always emailVerified) or a finished account never is.
 */
export const SIGNUP_TTL_INDEX = {
  fields: { signupExpiresAt: 1 },
  options: {
    name: 'unfinished_signup_ttl',
    expireAfterSeconds: 0,
    partialFilterExpression: { emailVerified: false, role: ROLES.USER },
  },
}
userSchema.index(SIGNUP_TTL_INDEX.fields, SIGNUP_TTL_INDEX.options)

export const User = mongoose.model('User', userSchema)
