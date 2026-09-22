import { z } from 'zod'
import { LEVELS, VIDEO_STATUS, VIDEO_STATUS_LIST } from '../../config/constants.js'
import { objectId } from './common.js'

const title = z.string({ error: 'Give the video a title.' }).trim().min(1, 'Give the video a title.').max(120, 'Keep the title under 120 characters.')
const level = z.enum(LEVELS, { error: `Level must be one of: ${LEVELS.join(', ')}.` })
const status = z.enum(VIDEO_STATUS_LIST, { error: `Status must be one of: ${VIDEO_STATUS_LIST.join(', ')}.` })
// An empty string (from a form's "Unassigned" option) means no category.
const categoryId = z.preprocess((value) => (value === '' ? null : value), objectId('category').nullable())

export const createVideoSchema = z.object({
  title,
  level: level.default(LEVELS[0]),
  status: status.default(VIDEO_STATUS.PUBLISHED),
  categoryId: categoryId.optional().default(null),
  durationSec: z.coerce.number({ error: 'Duration must be a number.' }).min(0).max(24 * 60 * 60).default(0),
})

export const updateVideoSchema = z.object({
  title: title.optional(),
  level: level.optional(),
  status: status.optional(),
  categoryId: categoryId.optional(),
  order: z.coerce.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to change.' })
