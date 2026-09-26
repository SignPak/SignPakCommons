import { z } from 'zod'

export const uploadDemoVideoSchema = z.object({
  title: z.string({ error: 'Give the demo video a title.' }).trim().min(1, 'Give the demo video a title.').max(120, 'Keep the title under 120 characters.'),
  durationSec: z.coerce.number({ error: 'Duration must be a number.' }).min(0).max(24 * 60 * 60).default(0),
})
