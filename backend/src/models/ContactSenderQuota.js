import mongoose from 'mongoose'

/**
 * S4: signed-out deletion requests per sender per UTC day. `key` is an HMAC of "ip:<address>"
 * or "device:<id>" (see contactService), so neither is stored in the clear and, unlike a plain
 * SHA-256, the IPv4 space can't simply be hashed and looked up. Rows remove themselves after
 * two days.
 */
const contactSenderQuotaSchema = new mongoose.Schema({
  key: { type: String, required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now, expires: 2 * 24 * 60 * 60 },
}, { versionKey: false })

contactSenderQuotaSchema.index({ key: 1, day: 1 }, { unique: true })

export const ContactSenderQuota = mongoose.model('ContactSenderQuota', contactSenderQuotaSchema)
