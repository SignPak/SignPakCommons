import { categoryService } from '../services/categoryService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'

export const categoryController = {
  list: asyncHandler(async (req, res) => ok(res, await categoryService.list())),
  create: asyncHandler(async (req, res) => created(res, await categoryService.create(req.body))),
  update: asyncHandler(async (req, res) => ok(res, await categoryService.update(req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => { await categoryService.remove(req.params.id); noContent(res) }),
}
