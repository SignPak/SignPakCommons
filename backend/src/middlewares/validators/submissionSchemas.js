import { z } from 'zod'
import { booleanField, objectId } from './common.js'

const seconds = (label) => z.coerce.number({ error: `${label} must be a number of seconds.` }).min(0, `${label} cannot be negative.`)

export const createSubmissionSchema = z.object({
  videoId: objectId('video'),
  trimStart: seconds('Trim start'),
  trimEnd: seconds('Trim end'),
  mirrored: booleanField.default(false),
  duration: seconds('Duration'),
})

// B7: GET /submissions. `mine` lets an admin ask for only their own (their library); `limit`
// (and `cursor`) give one page, `{ items, nextCursor, total }`, instead of the whole array.
export const listSubmissionsQuerySchema = z.object({
  mine: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: objectId('cursor').optional(),
})
