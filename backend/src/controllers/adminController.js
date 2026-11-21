import { auditService } from '../services/auditService.js'
import { deletionLookupService } from '../services/deletionLookupService.js'
import { statsService } from '../services/statsService.js'
import { submissionService } from '../services/submissionService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/response.js'

export const adminController = {
  stats: asyncHandler(async (req, res) => ok(res, await statsService.overview(req.query))),
  // C3: deletion requests.
  userSubmissions: asyncHandler(async (req, res) => ok(res, await submissionService.pageForUser(req.params.id, req.query))),
  removeUserSubmissions: asyncHandler(async (req, res) => ok(res, await submissionService.removeAllForUser(req.params.id, req.user, { requestMessageId: req.query.requestMessageId ?? null }))),
  deletionLookup: asyncHandler(async (req, res) => ok(res, await deletionLookupService.find(req.query))),
  // S7: the activity log.
  audit: asyncHandler(async (req, res) => ok(res, await auditService.list(req.query))),
}
