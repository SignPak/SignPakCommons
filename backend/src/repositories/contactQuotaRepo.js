import { ContactDailyQuota } from '../models/ContactDailyQuota.js'
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
}
