import { createHash } from 'node:crypto'
import { AccessRestriction } from '../models/AccessRestriction.js'
import { conflict, notFound } from '../utils/AppError.js'

const hash = (value) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

function hint(type, value) {
  if (type === 'ip') {
    const parts = value.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`
    return `${value.slice(0, 12)}...`
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

export const accessRestrictionService = {
  list: () => AccessRestriction.find().sort({ createdAt: -1 }),

  async create({ type, value, reason }, adminId) {
    try {
      return await AccessRestriction.create({
        type,
        identifierHash: hash(value),
        identifierHint: hint(type, value),
        reason,
        createdBy: adminId,
      })
    } catch (error) {
      if (error?.code === 11000) throw conflict('That identifier is already restricted.', { value: 'That identifier is already restricted.' })
      throw error
    }
  },

  async remove(id) {
    const result = await AccessRestriction.deleteOne({ _id: id })
    if (!result.deletedCount) throw notFound('That restriction does not exist.')
  },

  async isRequestRestricted(ip, deviceId) {
    const identifiers = [{ type: 'ip', identifierHash: hash(ip) }]
    if (deviceId) identifiers.push({ type: 'device', identifierHash: hash(deviceId) })
    return AccessRestriction.exists({ $or: identifiers })
  },
}