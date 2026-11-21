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

export const emailOnlySchema = z.object({ email: emailField })

const newPassword = z.string({ error: 'Create a password.' }).min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.')

// B3: the password chosen at sign-up is asked for again with the code, so only the person who
// set it can finish the sign-up (a re-signup can change it before the code is entered).
export const verifyEmailSchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code from your email.'),
  password: z.string({ error: 'Enter the password you chose when signing up.' }).min(1, 'Enter the password you chose when signing up.').max(200),
})

// Password change while logged in.
export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Enter your current password.' }).min(1, 'Enter your current password.').max(200),
  password: newPassword,
  confirmPassword: z.string(),
}).refine((data) => data.confirmPassword === data.password, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const resetPasswordSchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code from your email.'),
  password: z.string({ error: 'Create a password.' }).min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
  confirmPassword: z.string(),
}).refine((data) => data.confirmPassword === data.password, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const consentSchema = z.object({
  consentToken: z.string({ error: 'This sign-up step has expired. Verify your email again.' }).min(10).max(2000),
  accepted: z.literal(true, { error: 'You must accept the consent notice to create your account.' }),
  version: z.string({ error: 'Missing consent version.' }).min(1).max(40),
})

export const declineConsentSchema = z.object({
  consentToken: z.string({ error: 'This sign-up step has expired.' }).min(10).max(2000),
})
