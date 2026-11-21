import { isIP } from 'node:net'
import { z } from 'zod'
import { emailField, objectId } from './common.js'

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().max(500, 'Keep the reason under 500 characters.').optional().default(''),
})

export const accessRestrictionSchema = z.object({
  type: z.enum(['ip', 'device']),
  value: z.string().trim().min(1, 'Enter an IP address or device ID.').max(128),
  reason: z.string().trim().max(500, 'Keep the reason under 500 characters.').optional().default(''),
}).superRefine(({ type, value }, context) => {
  const valid = type === 'ip' ? isIP(value) !== 0 : /^[A-Za-z0-9._:-]{16,128}$/.test(value)
  if (!valid) context.addIssue({ code: 'custom', path: ['value'], message: type === 'ip' ? 'Enter a valid IPv4 or IPv6 address.' : 'Enter a valid device ID.' })
})

// Query strings carry booleans as "true"/"false"; anything else is invalid.
const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true')

// C3: a contributor's submissions, a page at a time (cursor = the last _id of the previous page).
export const userSubmissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: objectId('cursor').optional(),
})

// C3: the contact message the deletion answers, when there is one (kept in the DeletionLog).
export const removeSubmissionsQuerySchema = z.object({
  requestMessageId: objectId('message ID').optional(),
})

// C3: DELETE /admin/users/:id?withRecordings=true also deletes the recordings.
export const removeUserQuerySchema = z.object({
  withRecordings: queryBoolean.optional().default(false),
})

export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  topic: z.enum(['general', 'partnership', 'recording-deletion']).optional(),
  status: z.enum(['open', 'done', 'rejected']).optional(),
  verified: queryBoolean.optional(),
})

export const messageStatusSchema = z.object({
  status: z.enum(['open', 'done', 'rejected'], { error: 'Choose open, done or rejected.' }),
})

// C3: look up by message (what the admin page uses, so no email appears in a URL) or by email.
export const deletionLookupQuerySchema = z.object({
  email: emailField.optional(),
  messageId: objectId('message ID').optional(),
}).refine((query) => Boolean(query.email) !== Boolean(query.messageId), {
  path: ['email'],
  message: 'Give either an email address or a message ID.',
})
