import { VIDEO_STATUS } from '../config/constants.js'
import { Video } from '../models/Video.js'

export const videoRepo = {
  // Contributors see published videos that belong to a category. Admins see everything.
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
  /** B7: what the stats need of every video (the library is small). */
  titlesAndCategories: () => Video.find().select('title category'),
  /** B5/B7: the ids of one category's videos, for filtering submissions by category. */
  async idsInCategory(categoryId) {
    return (await Video.find({ category: categoryId }).select('_id').lean()).map((video) => String(video._id))
  },
}
