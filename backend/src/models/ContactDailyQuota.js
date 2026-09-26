import mongoose from 'mongoose'

const contactDailyQuotaSchema = new mongoose.Schema({
  _id: { type: String },
  count: { type: Number, default: 0, min: 0 },
}, { versionKey: false })

export const ContactDailyQuota = mongoose.model('ContactDailyQuota', contactDailyQuotaSchema)
