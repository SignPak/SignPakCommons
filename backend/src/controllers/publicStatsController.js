import { publicStatsService } from '../services/publicStatsService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/response.js'

export const publicStatsController = {
  get: asyncHandler(async (req, res) => ok(res, await publicStatsService.get())),
}
