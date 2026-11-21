import { ContactDailyQuota } from '../models/ContactDailyQuota.js'
import { ContactSenderQuota } from '../models/ContactSenderQuota.js'
import { ContactUserQuota } from '../models/ContactUserQuota.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'

export const contactQuotaRepo = {
  async claimUser(userId, day) {
    try {
      await ContactUserQuota.create({ user: userId, day })
      return true
    } catch (error) {
      if (isDuplicateKeyError(error)) return false
      throw error
    }
  },

  releaseUser(userId, day) {
    return ContactUserQuota.deleteOne({ user: userId, day })
  },

  async claimDaily(day, maximum) {
    try {
      await ContactDailyQuota.findOneAndUpdate(
        { _id: day, count: { $lt: maximum } },
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      )
      return true
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
      const updated = await ContactDailyQuota.findOneAndUpdate(
        { _id: day, count: { $lt: maximum } },
        { $inc: { count: 1 } },
        { new: true },
      )
      return Boolean(updated)
    }
  },

  releaseDaily(day) {
    return ContactDailyQuota.updateOne({ _id: day, count: { $gt: 0 } }, { $inc: { count: -1 } })
  },

  /** Claims one of `maximum` slots for a sender key on a day; false when the sender is at the limit. */
  async claimSender(key, day, maximum) {
    const claim = () => ContactSenderQuota.findOneAndUpdate(
      { key, day, count: { $lt: maximum } },
      { $inc: { count: 1 } },
      { upsert: true, new: true },
    )
    try {
      await claim()
      return true
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error
      // At the limit: the conditional filter missed and the upsert hit the unique index.
      const updated = await ContactSenderQuota.findOneAndUpdate(
        { key, day, count: { $lt: maximum } },
        { $inc: { count: 1 } },
        { new: true },
      )
      return Boolean(updated)
    }
  },

  releaseSender(key, day) {
    return ContactSenderQuota.updateOne({ key, day, count: { $gt: 0 } }, { $inc: { count: -1 } })
  },
}
