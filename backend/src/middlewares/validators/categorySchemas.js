import { z } from 'zod'
import { TONES } from '../../config/constants.js'

const label = z.string({ error: 'Give the category a name.' }).trim().min(1, 'Give the category a name.').max(60, 'Keep the name under 60 characters.')
const copy = z.string().trim().max(240, 'Keep the description under 240 characters.')
const tone = z.enum(TONES, { error: `Colour must be one of: ${TONES.join(', ')}.` })

export const createCategorySchema = z.object({ label, copy: copy.default(''), tone: tone.default(TONES[0]) })
export const updateCategorySchema = z.object({ label: label.optional(), copy: copy.optional(), tone: tone.optional() })
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to change.' })
