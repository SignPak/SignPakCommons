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
  async removeForUser(userId) {
    const submissions = await Submission.find({ user: userId }).select('recording')
    await Promise.all([
      Submission.deleteMany({ user: userId }),
      SubmissionCooldown.deleteMany({ user: userId }),
    ])
    return submissions.map((submission) => submission.recording)
  },
  // Just the timestamps, for bucketing into days.
  createdSince: (date) => Submission.find({ createdAt: { $gte: date } }).select('createdAt').lean(),
  countsByVideo: () => Submission.aggregate([{ $group: { _id: '$video', count: { $sum: 1 } } }]),

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
      return true
    } catch (error) {
      if (isDuplicateKeyError(error)) return false
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
