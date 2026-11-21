import { DeletedAccount } from '../models/DeletedAccount.js'
import { DeletionLog } from '../models/DeletionLog.js'

/** C3: deletion records. Both are append-only; nothing here updates or removes a row. */
export const deletionLogRepo = {
  create: (data) => DeletionLog.create(data),
  listForUser: (userId) => DeletionLog.find({ userId }).sort({ at: -1 }),
}

export const deletedAccountRepo = {
  create: (data) => DeletedAccount.create(data),
  findByEmailHash: (emailHash) => DeletedAccount.find({ emailHash }).sort({ deletedAt: -1 }),
  latestForUser: (userId) => DeletedAccount.findOne({ userId }).sort({ deletedAt: -1 }),
}
