import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'

const contactMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true, toJSON: jsonOptions((doc, ret) => {
  ret.userId = ret.user ? String(ret.user) : null
  delete ret.user
  delete ret.updatedAt
  return ret
}) })

contactMessageSchema.index({ createdAt: -1 })

export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema)
