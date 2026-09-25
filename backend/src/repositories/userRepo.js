import { User } from '../models/User.js'

export const userRepo = {
  findById: (id) => User.findById(id),
  findByEmail: (email, { withPassword = false } = {}) => {
    const query = User.findOne({ email: email.trim().toLowerCase() })
    return withPassword ? query.select('+passwordHash') : query
  },
  findManyByIds: (ids) => User.find({ _id: { $in: ids } }),
  create: (data) => User.create(data),
  save: (doc) => doc.save(),
  list: ({ role } = {}) => User.find(role ? { role } : {}).sort({ createdAt: 1 }),
  countByRole: (role) => User.countDocuments({ role }),
}
