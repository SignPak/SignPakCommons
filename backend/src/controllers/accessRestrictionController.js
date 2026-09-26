import { accessRestrictionService } from '../services/accessRestrictionService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'

export const accessRestrictionController = {
  list: asyncHandler(async (req, res) => ok(res, await accessRestrictionService.list())),
  create: asyncHandler(async (req, res) => created(res, await accessRestrictionService.create(req.body, req.user._id))),
  remove: asyncHandler(async (req, res) => { await accessRestrictionService.remove(req.params.id); noContent(res) }),
}