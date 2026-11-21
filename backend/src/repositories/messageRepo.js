import { ContactMessage } from '../models/ContactMessage.js'

const WITH_VERIFICATION = '+verificationCodeHash +verificationExpiresAt +verificationAttempts +verificationSentAt +verificationSendCount'

export const messageRepo = {
  create: (data) => ContactMessage.create(data),
  remove: (id) => ContactMessage.deleteOne({ _id: id }),
  list: (limit) => ContactMessage.find().sort({ createdAt: -1 }).limit(limit),
  /** The message with its (normally hidden) verification fields, for the code check. */
  findForVerification: (id) => ContactMessage.findById(id).select(WITH_VERIFICATION),
  save: (message) => message.save(),
  /**
   * Atomically claims a resend for a signed-out, unverified deletion request: only when the
   * last send is older than `sentBefore` and fewer than `maxSends` codes went out. Two
   * simultaneous calls can't both succeed. Returns null when the claim fails.
   */
  claimResend: (id, { sentBefore, maxSends, now = new Date() }) => ContactMessage.findOneAndUpdate(
    {
      _id: id,
      topic: 'recording-deletion',
      verified: false,
      user: null,
      $or: [{ verificationSentAt: null }, { verificationSentAt: { $lte: sentBefore } }],
      // $not also matches a document stored before this field existed.
      verificationSendCount: { $not: { $gte: maxSends } },
    },
    { $set: { verificationSentAt: now }, $inc: { verificationSendCount: 1 } },
    { new: true },
  ).select(WITH_VERIFICATION),
}
