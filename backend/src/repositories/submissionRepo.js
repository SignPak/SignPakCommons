import { Submission } from '../models/Submission.js'

export const submissionRepo = {
  create: (data) => Submission.create(data),
  findById: (id) => Submission.findById(id),
  findByUserAndVideo: (user, video) => Submission.findOne({ user, video }),
  list: ({ userId } = {}) => Submission.find(userId ? { user: userId } : {}).sort({ createdAt: -1 }),
  recent: (limit) => Submission.find().sort({ createdAt: -1 }).limit(limit),
  count: () => Submission.countDocuments(),
  // Just the timestamps, for bucketing into days.
  createdSince: (date) => Submission.find({ createdAt: { $gte: date } }).select('createdAt').lean(),
  countsByVideo: () => Submission.aggregate([{ $group: { _id: '$video', count: { $sum: 1 } } }]),
}
