import { z } from 'zod'
import { emailField } from './common.js'

const name = (label) => z.string({ error: `Enter your ${label}.` }).trim().min(1, `Enter your ${label}.`).max(60, `Keep your ${label} under 60 characters.`)

export const signupSchema = z.object({
  firstName: name('first name'),
  surname: name('surname'),
  email: emailField,
  // bcrypt only reads the first 72 bytes, so longer passwords would silently be truncated.
  password: z.string({ error: 'Create a password.' }).min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
  confirmPassword: z.string().optional(),
}).refine((data) => data.confirmPassword === undefined || data.confirmPassword === data.password, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(200),
})
