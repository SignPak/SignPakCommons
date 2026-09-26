import { isIP } from 'node:net'
import { z } from 'zod'

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