import { createHash } from 'node:crypto'
import { AccessRestriction } from '../models/AccessRestriction.js'
import { conflict, notFound } from '../utils/AppError.js'
import { auditService } from './auditService.js'

// Guarded against undefined/empty input: req.ip can be undefined if TRUST_PROXY is ever
// misconfigured behind a host's proxy, and this used to throw (value.trim() on undefined),
// turning every /api/v1/* request into a 500. An empty value still hashes safely; it just
// means "no IP could be determined" shares one bucket, which is a fine degraded fallback
// as long as TRUST_PROXY is set correctly in normal operation.
const hash = (value) => createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex')

function hint(type, value) {
  if (type === 'ip') {
    const parts = value.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`
    return `${value.slice(0, 12)}...`
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

export const accessRestrictionService = {
  list: () => AccessRestriction.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ createdAt: -1 }),

  /** S7: the activity entry keeps the type and the hint, never the IP address or device ID itself. */
  async create({ type, value, reason }, actor) {
    let restriction
    try {
      restriction = await AccessRestriction.create({
        type,
        identifierHash: hash(value),
        identifierHint: hint(type, value),
        reason,
        createdBy: actor?._id,
      })
    } catch (error) {
      if (error?.code === 11000) throw conflict('That identifier is already restricted.', { value: 'That identifier is already restricted.' })
      throw error
    }
    await auditService.record({ actor, action: 'restriction.create', targetType: 'restriction', targetId: restriction.id, meta: { type, hint: restriction.identifierHint } })
    return restriction
  },

  async remove(id, actor) {
    const restriction = await AccessRestriction.findOneAndDelete({ _id: id })
    if (!restriction) throw notFound('That restriction does not exist.')
    await auditService.record({ actor, action: 'restriction.delete', targetType: 'restriction', targetId: restriction.id, meta: { type: restriction.type, hint: restriction.identifierHint } })
  },

  async isRequestRestricted(ip, deviceId) {
    const identifiers = [{ type: 'ip', identifierHash: hash(ip) }]
    if (deviceId) identifiers.push({ type: 'device', identifierHash: hash(deviceId) })
    return AccessRestriction.exists({ $and: [
      { $or: identifiers },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    ] })
  },

}
