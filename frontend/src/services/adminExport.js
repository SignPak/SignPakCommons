import { apiRoutes } from './apiRoutes'
import { exportQuerySchema } from '../utils/adminQueries'
import { validateApiInput } from '../utils/validateApiInput'

/**
 * B5: the ML export's URL, with the query checked first. A plain link, so the browser streams
 * the file to disk. Built synchronously (it is a link's href), so it imports its schema directly;
 * only the lazily loaded Admin → Submissions page uses it, which keeps Zod out of the main chunk.
 */
export const adminExportUrl = (query) => apiRoutes.admin.exportSubmissions(validateApiInput(exportQuerySchema, query))
