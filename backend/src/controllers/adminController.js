import { auditService } from '../services/auditService.js'
import { deletionLookupService } from '../services/deletionLookupService.js'
import { statsService } from '../services/statsService.js'
import { EXPORT_COLUMNS, submissionService } from '../services/submissionService.js'
import { once } from 'node:events'
import { asyncHandler } from '../utils/asyncHandler.js'
import { CSV_BOM, csvRow } from '../utils/csv.js'
import { logger } from '../utils/logger.js'
import { ok } from '../utils/response.js'

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
    // Streamed row by row, waiting whenever the client is slower than the database.
    const write = async (chunk) => { if (!res.write(chunk)) await once(res, 'drain') }
    try {
      if (format === 'csv') await write(CSV_BOM + csvRow(EXPORT_COLUMNS))
      else await write('[')
      let first = true
      for await (const row of rows) {
        await write(format === 'csv' ? csvRow(EXPORT_COLUMNS.map((column) => row[column])) : `${first ? '' : ','}\n${JSON.stringify(row)}`)
        first = false
      }
      if (format === 'json') await write(first ? ']' : '\n]')
      res.end()
    } catch (error) {
      // The headers are already sent, so the only honest signal left is to cut the download.
      logger.error({ err: error }, 'Submissions export failed part-way')
      res.destroy(error)
    }
  }),
  // S7: the activity log.
  audit: asyncHandler(async (req, res) => ok(res, await auditService.list(req.query))),
}
