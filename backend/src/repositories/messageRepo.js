import { ContactMessage } from '../models/ContactMessage.js'

export const messageRepo = {
  create: (data) => ContactMessage.create(data),
  remove: (id) => ContactMessage.deleteOne({ _id: id }),
  list: (limit) => ContactMessage.find().sort({ createdAt: -1 }).limit(limit),
}
