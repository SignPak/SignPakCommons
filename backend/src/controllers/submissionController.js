import { submissionService } from '../services/submissionService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, ok } from '../utils/response.js'
import { sendFile } from '../utils/sendFile.js'

export const submissionController = {
  create: asyncHandler(async (req, res) => created(res, await submissionService.create(req.user, req.body, req.file))),
  list: asyncHandler(async (req, res) => ok(res, await submissionService.list(req.user))),
  // Recordings are private: no-store so browsers and proxies never keep a copy.
  recording: asyncHandler(async (req, res) => sendFile(req, res, await submissionService.getRecording(req.params.id), { cache: 'private, no-store' })),
}
