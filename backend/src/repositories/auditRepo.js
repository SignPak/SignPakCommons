import { AuditLog } from '../models/AuditLog.js'

/** S7: the activity log. Append-only: nothing here updates or removes an entry. */
export const auditRepo = {
  create: (data) => AuditLog.create(data),
  /** One page, newest first, and the total matching `filter`. */
  async list(filter, { skip, limit }) {
    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ])
    return { entries, total }
  },
}
