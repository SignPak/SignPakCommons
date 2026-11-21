import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'

/**
 * C3: written whenever an account is deleted, by an admin or by the contributor. Account
 * deletion keeps the recordings, so a later deletion request can still be matched to them by
 * hashing the request's email. Only the keyed hash is kept, never the address.
 */
const deletedAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  emailHash: { type: String, required: true, index: true },
  by: { type: String, enum: ['self', 'admin'], required: true },
  deletedAt: { type: Date, default: Date.now },
}, { toJSON: jsonOptions() })

export const DeletedAccount = mongoose.model('DeletedAccount', deletedAccountSchema)
