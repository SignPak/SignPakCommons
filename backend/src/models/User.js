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
  role: { type: String, enum: ROLE_LIST, default: ROLES.USER },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  statusReason: { type: String, trim: true, maxlength: 500, default: '' },
  lastDeviceId: { type: String, select: false, default: null },
  connections: {
    github: { type: String, default: null },
    linkedin: { type: String, default: null },
  },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => {
    for (const key of ['passwordHash', 'authVersion', 'updatedAt', 'lastDeviceId', 'emailVerificationCodeHash', 'emailVerificationExpiresAt', 'emailVerificationAttempts', 'emailVerificationSentAt', 'passwordResetCodeHash', 'passwordResetExpiresAt', 'passwordResetAttempts', 'passwordResetSentAt']) delete ret[key]
    return ret
  }),
})

export const User = mongoose.model('User', userSchema)
