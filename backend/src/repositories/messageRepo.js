import { ContactMessage } from '../models/ContactMessage.js'

const WITH_VERIFICATION = '+verificationCodeHash +verificationExpiresAt +verificationAttempts +verificationSentAt'

export const messageRepo = {
  create: (data) => ContactMessage.create(data),
  remove: (id) => ContactMessage.deleteOne({ _id: id }),
  list: (limit) => ContactMessage.find().sort({ createdAt: -1 }).limit(limit),
  /** The message with its (normally hidden) verification fields, for the code check. */
  findForVerification: (id) => ContactMessage.findById(id).select(WITH_VERIFICATION),
  save: (message) => message.save(),
}
