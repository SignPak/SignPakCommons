import { auditService } from '../services/auditService.js'
import { deletionLookupService } from '../services/deletionLookupService.js'
import { statsService } from '../services/statsService.js'
import { EXPORT_COLUMNS, submissionService } from '../services/submissionService.js'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { asyncHandler } from '../utils/asyncHandler.js'
import { CSV_BOM, csvRow } from '../utils/csv.js'
import { logger } from '../utils/logger.js'
import { ok } from '../utils/response.js'

// What stream.pipeline rejects with when the client closes the connection during an export.
const CLIENT_GONE = new Set(['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'EPIPE'])

export const adminController = {
  stats: asyncHandler(async (req, res) => ok(res, await statsService.overview(req.query))),
  // C3: deletion requests.
  userSubmissions: asyncHandler(async (req, res) => ok(res, await submissionService.pageForUser(req.params.id, req.query))),
  removeUserSubmissions: asyncHandler(async (req, res) => ok(res, await submissionService.removeAllForUser(req.params.id, req.user, { requestMessageId: req.query.requestMessageId ?? null }))),
  deletionLookup: asyncHandler(async (req, res) => ok(res, await deletionLookupService.find(req.query))),
  // B5: the admin submissions list and the ML export.
  submissions: asyncHandler(async (req, res) => ok(res, await submissionService.adminPage(req.query))),
  exportSubmissions: asyncHandler(async (req, res) => {
    const { format, ...filters } = req.query
    const rows = await submissionService.exportRows(filters, req.user, { format })
    const date = new Date().toISOString().slice(0, 10)
    res.status(200)
    res.set({
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="signpak-submissions-${date}.${format}"`,
      'Cache-Control': 'no-store',
    })
    // B5: stream.pipeline pulls one chunk at a time as the client reads (backpressure), and when
    // the client goes away it destroys the source, which closes the generators and with them the
    // MongoDB cursor (see submissionService.exportRows).
    async function* chunks() {
      if (format === 'csv') yield CSV_BOM + csvRow(EXPORT_COLUMNS)
      else yield '['
      let first = true
      for await (const row of rows) {
        yield format === 'csv' ? csvRow(EXPORT_COLUMNS.map((column) => row[column])) : `${first ? '' : ','}\n${JSON.stringify(row)}`
        first = false
      }
      if (format === 'json') yield first ? ']' : '\n]'
    }
    try {
      await pipeline(Readable.from(chunks()), res)
    } catch (error) {
      // A cancelled download is not a failure of ours. pipeline rejects with the source's own
      // error when the export fails, and with a premature close (or a socket reset) when the
      // client leaves. (req.destroyed can't tell them apart: cutting the response destroys it too.)
      if (CLIENT_GONE.has(error.code)) {
        logger.info({ format }, 'Submissions export cancelled by the client')
        return
      }
      // The headers are already sent, so the only honest signal left is to cut the download:
      // pipeline has already destroyed the response.
      logger.error({ err: error }, 'Submissions export failed part-way')
    }
  }),
  // S7: the activity log.
  audit: asyncHandler(async (req, res) => ok(res, await auditService.list(req.query))),
}
