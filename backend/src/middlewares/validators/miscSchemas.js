import { z } from 'zod'
import { emailField, objectId } from './common.js'

export const contactSchema = z.object({
  topic: z.enum(['general', 'partnership', 'recording-deletion']).default('general'),
  name: z.string({ error: 'Enter your name.' }).trim().min(1, 'Enter your name.').max(100, 'Keep your name under 100 characters.'),
  email: emailField,
  message: z.string({ error: 'Write a message.' }).trim().min(1, 'Write a message.').max(2000, 'Keep your message under 2000 characters.'),
})

// D4: the six-digit code emailed for a signed-out deletion request.
export const contactCodeSchema = z.object({
  code: z.string({ error: 'Enter the six-digit code from your email.' }).trim().regex(/^\d{6}$/, 'Enter the six-digit code from your email.'),
})

// B7: the dashboard's range and its optional contributor and category filters.
export const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(14),
  userId: objectId('contributor').optional(),
  categoryId: objectId('category').optional(),
})

export const limitQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
