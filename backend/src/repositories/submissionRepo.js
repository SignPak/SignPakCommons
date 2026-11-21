import { Submission } from '../models/Submission.js'
import { SubmissionCooldown } from '../models/SubmissionCooldown.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'

export const submissionRepo = {
  create: (data) => Submission.create(data),
  findById: (id) => Submission.findById(id),
  list: ({ userId } = {}) => Submission.find(userId ? { user: userId } : {}).sort({ createdAt: -1 }),
  recent: (limit) => Submission.find().sort({ createdAt: -1 }).limit(limit),
  countForPair: (userId, videoId) => Submission.countDocuments({ user: userId, video: videoId }),
  count: () => Submission.countDocuments(),
  clearCooldownsForUser: (userId) => SubmissionCooldown.deleteMany({ user: userId }),
  countForUser: (userId) => Submission.countDocuments({ user: userId }),
  /** Every submission of one contributor, with the stored-file pointer (C3 deletion). */
  allForUser: (userId) => Submission.find({ user: userId }),
  removeMany: (ids) => Submission.deleteMany({ _id: { $in: ids } }),

  /**
   * One page of a contributor's submissions, newest first. The cursor is the last `_id` of the
   * previous page (ObjectIds grow with time), so pages stay stable while rows are deleted.
   */
  async pageForUser(userId, { limit, cursor }) {
    const filter = { user: userId, ...(cursor ? { _id: { $lt: cursor } } : {}) }
    const [rows, total] = await Promise.all([
      Submission.find(filter).sort({ _id: -1 }).limit(limit + 1),
      Submission.countDocuments({ user: userId }),
    ])
    const items = rows.slice(0, limit)
    return { items, total, nextCursor: rows.length > limit ? String(items.at(-1)._id) : null }
  },
  // Just the timestamps, for bucketing into days.
  createdSince: (date) => Submission.find({ createdAt: { $gte: date } }).select('createdAt').lean(),
  countsByVideo: () => Submission.aggregate([{ $group: { _id: '$video', count: { $sum: 1 } } }]),

  /**
   * B7: the dashboard's counts for the submissions matching `match` (already cast: aggregate does
   * not cast ids): per UTC day, per video, per contributor, and the total, in one pass.
   */
  async statsFor(match) {
    const [result] = await Submission.aggregate([
      { $match: match },
      { $facet: {
        byDay: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }],
        byVideo: [{ $group: { _id: '$video', count: { $sum: 1 } } }],
        byUser: [{ $group: { _id: '$user', count: { $sum: 1 } } }],
        total: [{ $count: 'count' }],
      } },
    ])
    return { byDay: result.byDay, byVideo: result.byVideo, byUser: result.byUser, total: result.total[0]?.count ?? 0 }
  },
  recentMatching: (match, limit) => Submission.find(match).sort({ createdAt: -1, _id: -1 }).limit(limit),

  /**
   * B5/B7: one page of the submissions matching `filter`, newest first. The cursor is the last
   * `_id` of the previous page, as in pageForUser, so pages stay stable while rows are deleted.
   */
  async page(filter, { limit, cursor }) {
    const pageFilter = cursor ? { $and: [filter, { _id: { $lt: cursor } }] } : filter
    const [rows, total] = await Promise.all([
      Submission.find(pageFilter).sort({ _id: -1 }).limit(limit + 1),
      Submission.countDocuments(filter),
    ])
    const items = rows.slice(0, limit)
    return { items, total, nextCursor: rows.length > limit ? String(items.at(-1)._id) : null }
  },
  /** B5: every submission matching `filter`, oldest first, read as a stream for the export. */
  exportCursor: (filter) => Submission.find(filter).sort({ _id: 1 }).lean().cursor(),

  /**
   * Atomically tries to start a cooldown window for (user, video). Returns true if this call
   * won (no other submission for this pair is currently inside its cooldown), false if one
   * already is. Race-safe under concurrent requests: the conditional filter plus the unique
   * index on SubmissionCooldown make this a compare-and-swap, not a read-then-write.
   *  - No cooldown doc yet -> upsert inserts one. Wins.
   *  - Doc exists, its window already elapsed (lockedUntil <= now) -> matches, gets updated
   *    to a fresh window. Wins.
   *  - Doc exists, still inside its window -> filter does not match, so the upsert instead
   *    tries to INSERT a new one (user, video) and collides with the unique index. Loses.
   */
  async claimCooldown(user, video, cooldownMs) {
    const now = new Date()
    try {
      await SubmissionCooldown.findOneAndUpdate(
        { user, video, lockedUntil: { $lte: now } },
        { $set: { lockedUntil: new Date(now.getTime() + cooldownMs) } },
        { upsert: true },
      )
      return now
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  },

  /** The remaining wait, in ms (0 if none), without claiming anything. Used to build the error message. */
  async cooldownRemaining(user, video) {
    const doc = await SubmissionCooldown.findOne({ user, video }).select('lockedUntil').lean()
    if (!doc) return 0
    return Math.max(0, doc.lockedUntil.getTime() - Date.now())
  },

  /** Frees a claimed cooldown, so a failed submission does not lock someone out for nothing. */
  releaseCooldown: (user, video) => SubmissionCooldown.deleteOne({ user, video }),
}
