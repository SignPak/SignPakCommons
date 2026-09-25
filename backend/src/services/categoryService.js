import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { conflict, notFound } from '../utils/AppError.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'

const nameTaken = () => conflict('A category with that name already exists.', { label: 'A category with that name already exists.' })

export const categoryService = {
  list: () => categoryRepo.list(),

  async create({ label, copy, tone }) {
    if (await categoryRepo.findByLabel(label)) throw nameTaken()
    try {
      return await categoryRepo.create({ label, copy, tone })
    } catch (error) {
      if (isDuplicateKeyError(error)) throw nameTaken()
      throw error
    }
  },

  async update(id, patch) {
    const category = await categoryRepo.findById(id)
    if (!category) throw notFound('That category does not exist.')
    if (patch.label) {
      const other = await categoryRepo.findByLabel(patch.label)
      if (other && other.id !== category.id) throw nameTaken()
    }
    category.set(patch)
    try {
      return await categoryRepo.save(category)
    } catch (error) {
      if (isDuplicateKeyError(error)) throw nameTaken()
      throw error
    }
  },

  /** Deleting a category keeps its videos; they become unassigned (and hidden from contributors). */
  async remove(id) {
    const category = await categoryRepo.findById(id)
    if (!category) throw notFound('That category does not exist.')
    await videoRepo.unassignCategory(category.id)
    await categoryRepo.remove(category.id)
  },
}
