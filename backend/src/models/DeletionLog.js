import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'

/**
 * C3: the record that an admin deleted a contributor's recordings. Append-only, except that
 * accountDeleted is set to true once the account itself has been deleted (Phase 7 item 5): it
 * is written false and never claims a deletion that did not happen. It never holds
 * the email address, only its keyed hash (src/utils/emailHash.js), and null when the account
 * was already gone and no hash is known.
 */
const deletionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  emailHash: { type: String, default: null },
  deleted: { type: Number, required: true, min: 0 },
  failed: { type: Number, required: true, min: 0 },
  accountDeleted: { type: Boolean, default: false },
  requestMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactMessage', default: null },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, default: Date.now },
}, { toJSON: jsonOptions() })

export const DeletionLog = mongoose.model('DeletionLog', deletionLogSchema)
