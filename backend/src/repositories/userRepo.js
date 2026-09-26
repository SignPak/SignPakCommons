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
  list: ({ role, includeDeviceIds = false } = {}) => {
    const query = User.find(role ? { role } : {}).sort({ createdAt: 1 })
    return includeDeviceIds ? query.select('+lastDeviceId') : query
  },
  countByRole: (role) => User.countDocuments({ role }),
  countActiveAdmins: () => User.countDocuments({ role: 'admin', status: 'active' }),
  remove: (id) => User.deleteOne({ _id: id }),
}
