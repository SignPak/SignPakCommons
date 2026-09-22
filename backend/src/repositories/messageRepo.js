import { ContactMessage } from '../models/ContactMessage.js'

export const messageRepo = {
  create: (data) => ContactMessage.create(data),
  list: (limit) => ContactMessage.find().sort({ createdAt: -1 }).limit(limit),
}
