import { DeletedAccount } from '../models/DeletedAccount.js'
import { DeletionLog } from '../models/DeletionLog.js'

/**
 * C3: deletion records. Both are append-only; nothing here removes a row. The one update is
 * Phase 7 item 5: a DeletionLog is marked accountDeleted once the account has really gone.
 */
export const deletionLogRepo = {
  create: (data) => DeletionLog.create(data),
  markAccountDeleted: (id) => DeletionLog.updateOne({ _id: id }, { $set: { accountDeleted: true } }),
  listForUser: (userId) => DeletionLog.find({ userId }).sort({ at: -1 }),
}

export const deletedAccountRepo = {
  create: (data) => DeletedAccount.create(data),
  findByEmailHash: (emailHash) => DeletedAccount.find({ emailHash }).sort({ deletedAt: -1 }),
  latestForUser: (userId) => DeletedAccount.findOne({ userId }).sort({ deletedAt: -1 }),
}
