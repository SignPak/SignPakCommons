import { z } from 'zod'

const email = z.string({ error: 'Enter your email address.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address, like you@example.com.'))

const name = (label) => z.string({ error: `Enter your ${label}.` })
  .trim()
  .min(1, `Enter your ${label}.`)
  .max(60, `Keep your ${label} under 60 characters.`)

const password = z.string({ error: 'Create a password.' })
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')

const code = z.string().regex(/^\d{6}$/, 'Enter the six-digit code from your email.')

const matchingPasswords = (values, context) => {
  if (values.confirmPassword !== values.password) {
    context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' })
  }
}

export const loginFormSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(200),
})

export const signupFormSchema = z.object({
  firstName: name('first name'),
  surname: name('surname'),
  email,
  password,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).superRefine(matchingPasswords)

export const signupRequestSchema = z.object({
  firstName: name('first name'),
  surname: name('surname'),
  email,
  password,
  confirmPassword: z.string().optional(),
}).superRefine((values, context) => {
  if (values.confirmPassword !== undefined) matchingPasswords(values, context)
})

export const verifyEmailSchema = z.object({ email, code })
export const emailOnlySchema = z.object({ email })

export const resetPasswordSchema = z.object({
  email,
  code,
  password,
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).superRefine(matchingPasswords)

export const consentRequestSchema = z.object({
  consentToken: z.string().min(10, 'This sign-up step has expired. Verify your email again.').max(2000),
  accepted: z.literal(true, { error: 'You must accept the consent notice to create your account.' }),
  version: z.string().min(1, 'Missing consent version.').max(40),
})

export const acceptConsentRequestSchema = z.object({
  accepted: z.literal(true, { error: 'You must accept the consent notice to continue.' }),
  version: z.string().min(1, 'Missing consent version.').max(40),
})

export const declineConsentRequestSchema = z.object({
  consentToken: z.string().min(10, 'This sign-up step has expired.').max(2000),
})

export const consentFormSchema = z.object({
  accepted: z.literal(true, { error: 'You must accept the consent notice to continue.' }),
})
