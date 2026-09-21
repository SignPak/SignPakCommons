import { z } from 'zod'
import { booleanField, objectId } from './common.js'

const seconds = (label) => z.coerce.number({ error: `${label} must be a number of seconds.` }).min(0, `${label} cannot be negative.`)

export const createSubmissionSchema = z.object({
  videoId: objectId('lesson'),
  trimStart: seconds('Trim start'),
  trimEnd: seconds('Trim end'),
  mirrored: booleanField.default(false),
  duration: seconds('Duration'),
})
