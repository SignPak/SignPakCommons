import { statsService } from '../services/statsService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/response.js'

export const adminController = {
  stats: asyncHandler(async (req, res) => ok(res, await statsService.overview(req.query))),
}
