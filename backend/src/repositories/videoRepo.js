import { VIDEO_STATUS } from '../config/constants.js'
import { Video } from '../models/Video.js'

export const videoRepo = {
  // Learners see published videos that belong to a category. Admins see everything.
  listVisible: ({ isAdmin }) => Video.find(isAdmin ? {} : { status: VIDEO_STATUS.PUBLISHED, category: { $ne: null } }).sort({ order: 1, createdAt: 1 }),
  findById: (id) => Video.findById(id),
  findManyByIds: (ids) => Video.find({ _id: { $in: ids } }),
  create: (data) => Video.create(data),
  save: (doc) => doc.save(),
  remove: (id) => Video.deleteOne({ _id: id }),
  async maxOrder(categoryId) {
    const last = await Video.findOne({ category: categoryId }).sort({ order: -1 }).select('order')
    return last?.order ?? 0
  },
  unassignCategory: (categoryId) => Video.updateMany({ category: categoryId }, { $set: { category: null } }),
  count: (filter = {}) => Video.countDocuments(filter),
  categoryOfEach: () => Video.find().select('category'),
}
