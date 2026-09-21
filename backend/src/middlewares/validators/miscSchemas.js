import { z } from 'zod'
import { emailField } from './common.js'

export const contactSchema = z.object({
  name: z.string({ error: 'Enter your name.' }).trim().min(1, 'Enter your name.').max(100, 'Keep your name under 100 characters.'),
  email: emailField,
  message: z.string({ error: 'Write a message.' }).trim().min(1, 'Write a message.').max(2000, 'Keep your message under 2000 characters.'),
})

export const statsQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(14) })

export const limitQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
