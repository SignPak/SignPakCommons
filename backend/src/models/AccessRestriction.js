import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'

const accessRestrictionSchema = new mongoose.Schema({
  type: { type: String, enum: ['ip', 'device'], required: true },
  identifierHash: { type: String, required: true },
  identifierHint: { type: String, required: true },
  reason: { type: String, trim: true, maxlength: 500, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  expiresAt: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: jsonOptions((doc, ret) => { delete ret.identifierHash; return ret }),
})

accessRestrictionSchema.index({ type: 1, identifierHash: 1 }, { unique: true })
accessRestrictionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const AccessRestriction = mongoose.model('AccessRestriction', accessRestrictionSchema)