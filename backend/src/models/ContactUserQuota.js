import mongoose from 'mongoose'

const contactUserQuotaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: String, required: true },
}, { versionKey: false })

contactUserQuotaSchema.index({ user: 1, day: 1 }, { unique: true })

export const ContactUserQuota = mongoose.model('ContactUserQuota', contactUserQuotaSchema)
