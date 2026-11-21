import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'

export const CONTACT_TOPICS = ['general', 'partnership', 'recording-deletion']
export const CONTACT_STATUSES = ['open', 'done', 'rejected']

// Never sent to any client, the admin list included.
const VERIFICATION_SECRETS = ['verificationCodeHash', 'verificationExpiresAt', 'verificationAttempts', 'verificationSentAt']

const contactMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  topic: { type: String, enum: CONTACT_TOPICS, default: 'general' },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },

  // D4: a deletion request is verified when it came from a signed-in contributor, or when the
  // code emailed to the account was entered. Requests for an email with no account stay
  // unverified and are checked by hand (Phase 5, Admin -> Messages).
  verified: { type: Boolean, default: false },
  verificationCodeHash: { type: String, default: null, select: false },
  verificationExpiresAt: { type: Date, default: null, select: false },
  verificationAttempts: { type: Number, default: 0, select: false },
  verificationSentAt: { type: Date, default: null, select: false },

  // Handling by the team (set from Admin -> Messages in Phase 5).
  status: { type: String, enum: CONTACT_STATUSES, default: 'open' },
  handledAt: { type: Date, default: null },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, toJSON: jsonOptions((doc, ret) => {
  ret.userId = ret.user ? String(ret.user) : null
  ret.handledBy = ret.handledBy ? String(ret.handledBy) : null
  delete ret.user
  delete ret.updatedAt
  for (const key of VERIFICATION_SECRETS) delete ret[key]
  return ret
}) })

contactMessageSchema.index({ createdAt: -1 })

export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema)
