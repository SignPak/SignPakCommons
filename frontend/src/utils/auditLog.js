import { z } from 'zod'

/** S7: the activity log's actions, as the admin pages show them. Matches the API's list. */
export const AUDIT_ACTION_LABELS = {
  'video.create': 'Added a video',
  'video.update': 'Edited a video',
  'video.delete': 'Deleted a video',
  'category.create': 'Added a category',
  'category.update': 'Edited a category',
  'category.delete': 'Deleted a category',
  'demo.upload': 'Uploaded the demo video',
  'demo.delete': 'Removed the demo video',
  'user.suspend': 'Suspended an account',
  'user.reactivate': 'Reactivated an account',
  'user.delete': 'Deleted an account',
  'recordings.delete': 'Deleted recordings',
  'restriction.create': 'Added a restriction',
  'restriction.delete': 'Removed a restriction',
  'message.status': 'Changed a message status',
  'admin.promote': 'Made an admin',
  'admin.demote': 'Removed an admin',
}

const objectId = /^[a-f\d]{24}$/i

/** GET /admin/audit query, checked before it is sent (the API checks it again). */
export const auditQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
  actor: z.union([z.literal('system'), z.string().regex(objectId, 'That admin is not valid.')]).optional(),
  action: z.enum(Object.keys(AUDIT_ACTION_LABELS)).optional(),
})

const META_LABELS = {
  title: 'Title', label: 'Name', status: 'Status', changed: 'Changed', reason: 'Reason', type: 'Type', hint: 'Identifier',
  topic: 'Topic', deleted: 'Deleted', failed: 'Failed', withRecordings: 'With recordings', requestMessageId: 'Request',
}

/** The details column: the entry's meta as short "Label: value" pairs. */
export function auditDetails(meta = {}) {
  return Object.entries(meta)
    .filter(([, value]) => value !== null && value !== '' && value !== undefined)
    .map(([key, value]) => `${META_LABELS[key] || key}: ${typeof value === 'boolean' ? (value ? 'yes' : 'no') : value}`)
    .join(' · ')
}
