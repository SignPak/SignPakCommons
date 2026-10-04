import { videoService } from '../services/videoService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'
import { sendFile } from '../utils/sendFile.js'

export const videoController = {
  list: asyncHandler(async (req, res) => ok(res, await videoService.list(req.user))),
  get: asyncHandler(async (req, res) => ok(res, await videoService.get(req.params.id, req.user))),

  create: asyncHandler(async (req, res) => {
    try {
      const result = await videoService.create(req.user, req.body, req.files)
      return created(res, result)
    } catch (err) {
      console.error('================ VIDEO CREATE FAILURE ================')
      console.error('Timestamp:', new Date().toISOString())
      console.error('Error Name:', err?.name)
      console.error('Error Message:', err?.message)
      console.error('Status/Code:', err?.status || err?.statusCode || err?.code)
      if (err?.cause) console.error('Error Cause:', err.cause)
      console.error('Stack Trace:', err?.stack)
      console.error('======================================================')
      throw err // Re-throws to express global error handler
    }
  }),

  update: asyncHandler(async (req, res) => ok(res, await videoService.update(req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => { await videoService.remove(req.params.id); noContent(res) }),
  file: asyncHandler(async (req, res) => sendFile(req, res, await videoService.getFile(req.params.id, req.user))),
  poster: asyncHandler(async (req, res) => sendFile(req, res, await videoService.getPoster(req.params.id, req.user))),
}
