import { Category } from '../models/Category.js'

export const categoryRepo = {
  list: () => Category.find().sort({ createdAt: 1 }),
  findById: (id) => Category.findById(id),
  findByLabel: (label) => Category.findOne({ labelKey: label.trim().toLowerCase() }),
  create: (data) => Category.create(data),
  save: (doc) => doc.save(), // save() re-runs validation and the labelKey hook
  remove: (id) => Category.deleteOne({ _id: id }),
  count: () => Category.countDocuments(),
}
