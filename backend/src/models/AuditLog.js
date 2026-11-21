import mongoose from 'mongoose'
import { AUDIT_ACTIONS } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'

/**
 * S7: the activity log, one entry per admin action: who (actorId; null is the system, for the
 * startup admin sync), what (action), on what (targetType, targetId) and when (at). `meta` is a
 * small object of plain values, cleaned by auditService.sanitizeMeta: never a secret or an
 * email address. Append-only.
 *
 * bufferCommands is off so a write without a database connection fails at once (and is logged
 * by auditService) instead of waiting for a connection that is not coming.
 */
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, enum: AUDIT_ACTIONS, required: true },
  targetType: { type: String, required: true, maxlength: 40 },
  targetId: { type: String, default: null, maxlength: 64 },
  meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  at: { type: Date, default: Date.now },
}, { minimize: false, bufferCommands: false, toJSON: jsonOptions() })

auditLogSchema.index({ at: -1 })
auditLogSchema.index({ actorId: 1, at: -1 })

export const AuditLog = mongoose.model('AuditLog', auditLogSchema)
