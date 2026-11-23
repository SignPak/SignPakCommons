import { z } from './zod'

/**
 * B5/B7: the admin list, export and stats queries, checked before a request is sent (the API
 * checks them again). Empty filters are left out by the callers.
 */
const objectId = (label) => z.string().regex(/^[a-f\d]{24}$/i, `That ${label} is not valid.`)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-22.')
const fromBeforeTo = (query, context) => {
  if (query.from && query.to && query.from > query.to) context.addIssue({ code: 'custom', path: ['to'], message: 'The end date must be on or after the start date.' })
}

const submissionFilters = {
  categoryId: objectId('category').optional(),
  videoId: objectId('video').optional(),
  userId: objectId('contributor').optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
}

export const statsQuerySchema = z.object({
  days: z.number().int().min(7).max(90).default(14),
  userId: objectId('contributor').optional(),
  categoryId: objectId('category').optional(),
})

export const adminSubmissionsQuerySchema = z.object({
  ...submissionFilters,
  limit: z.number().int().min(1).max(100).default(25),
  cursor: objectId('page').optional(),
}).superRefine(fromBeforeTo)

export const exportQuerySchema = z.object({
  ...submissionFilters,
  format: z.enum(['csv', 'json']),
}).superRefine(fromBeforeTo)

export const usersPageQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: objectId('page').optional(),
  role: z.enum(['user', 'admin']).optional(),
  q: z.string().trim().max(100).optional(),
})
