import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { conflict, notFound } from '../utils/AppError.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'
import { auditService } from './auditService.js'

const nameTaken = () => conflict('A category with that name already exists.', { label: 'A category with that name already exists.' })

export const categoryService = {
  list: () => categoryRepo.list(),

  async create({ label, copy, tone }, actor) {
    if (await categoryRepo.findByLabel(label)) throw nameTaken()
    let category
    try {
      category = await categoryRepo.create({ label, copy, tone })
    } catch (error) {
      if (isDuplicateKeyError(error)) throw nameTaken()
      throw error
    }
    await auditService.record({ actor, action: 'category.create', targetType: 'category', targetId: category.id, meta: { label: category.label } })
    return category
  },

  async update(id, patch, actor) {
    const category = await categoryRepo.findById(id)
    if (!category) throw notFound('That category does not exist.')
    if (patch.label) {
      const other = await categoryRepo.findByLabel(patch.label)
      if (other && other.id !== category.id) throw nameTaken()
    }
    category.set(patch)
    let saved
    try {
      saved = await categoryRepo.save(category)
    } catch (error) {
      if (isDuplicateKeyError(error)) throw nameTaken()
      throw error
    }
    await auditService.record({ actor, action: 'category.update', targetType: 'category', targetId: saved.id, meta: { label: saved.label, changed: Object.keys(patch).join(',') } })
    return saved
  },

  /** Deleting a category keeps its videos; they become unassigned (and hidden from contributors). */
  async remove(id, actor) {
    const category = await categoryRepo.findById(id)
    if (!category) throw notFound('That category does not exist.')
    await videoRepo.unassignCategory(category.id)
    await categoryRepo.remove(category.id)
    await auditService.record({ actor, action: 'category.delete', targetType: 'category', targetId: category.id, meta: { label: category.label } })
  },
}
