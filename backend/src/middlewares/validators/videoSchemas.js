import { z } from 'zod'
import { VIDEO_STATUS, VIDEO_STATUS_LIST } from '../../config/constants.js'
import { objectId } from './common.js'

const title = z.string({ error: 'Give the video a title.' }).trim().min(1, 'Give the video a title.').max(120, 'Keep the title under 120 characters.')
const status = z.enum(VIDEO_STATUS_LIST, { error: `Status must be one of: ${VIDEO_STATUS_LIST.join(', ')}.` })
// An empty string (from a form's "Unassigned" option) means no category.
const categoryId = z.preprocess((value) => (value === '' ? null : value), objectId('category').nullable())
const videoUrl = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.url({ error: 'Enter a valid direct video URL.' })
    .refine((value) => value.startsWith('https://'), 'Video URLs must use HTTPS.')
    .optional(),
)

const pixels = z.coerce.number({ error: 'Size must be a number.' }).int().min(0).max(16384).default(0)

export const createVideoSchema = z.object({
  title,
  status: status.default(VIDEO_STATUS.PUBLISHED),
  categoryId: categoryId.optional().default(null),
  videoUrl,
  durationSec: z.coerce.number({ error: 'Duration must be a number.' }).min(0).max(24 * 60 * 60).default(0),
  width: pixels,
  height: pixels,
})

export const updateVideoSchema = z.object({
  title: title.optional(),
  status: status.optional(),
  categoryId: categoryId.optional(),
  order: z.coerce.number().int().min(0).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to change.' })
