import { submissionService } from '../services/submissionService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, ok } from '../utils/response.js'

export const submissionController = {
  create: asyncHandler(async (req, res) => created(res, await submissionService.create(req.user, req.body, req.file))),
  list: asyncHandler(async (req, res) => ok(res, await submissionService.list(req.user))),
}
