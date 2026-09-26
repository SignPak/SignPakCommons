import { demoVideoService } from '../services/demoVideoService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'
import { sendFile } from '../utils/sendFile.js'

export const demoVideoController = {
  get: asyncHandler(async (req, res) => ok(res, await demoVideoService.get())),
  upload: asyncHandler(async (req, res) => created(res, await demoVideoService.upload(req.body, req.file))),
  remove: asyncHandler(async (req, res) => { await demoVideoService.remove(); noContent(res) }),
  file: asyncHandler(async (req, res) => sendFile(req, res, await demoVideoService.getFile(), { cache: 'no-cache' })),
}
