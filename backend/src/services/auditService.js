import { auditRepo } from '../repositories/auditRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { logger } from '../utils/logger.js'

// Keys that could carry a secret or a personal detail never reach the log.
const UNSAFE_KEY = /password|token|secret|hash|code|email|cookie|otp/i
const MAX_KEYS = 10
const MAX_STRING = 200

/** S7: `meta` is a small object of plain values: no secrets, no email addresses, no nesting. */
export function sanitizeMeta(meta) {
  const clean = {}
  if (!meta || typeof meta !== 'object') return clean
  for (const [key, value] of Object.entries(meta)) {
    if (Object.keys(clean).length >= MAX_KEYS) break
    if (UNSAFE_KEY.test(key)) continue
    if (value === null || typeof value === 'number' || typeof value === 'boolean') clean[key] = value
    else if (typeof value === 'string') clean[key] = value.slice(0, MAX_STRING)
  }
  return clean
}

const nameOf = (user) => `${user.firstName} ${user.surname}`.trim()

export const auditService = {
  /**
   * S7: writes one activity entry. `actor` is the admin (a user document) or null for the
   * system. The action it describes has already happened, so a failed write is logged and does
   * not fail the request.
   */
  async record({ actor, action, targetType, targetId = null, meta }) {
    const entry = { actorId: actor?._id ?? null, action, targetType, targetId: targetId == null ? null : String(targetId), meta: sanitizeMeta(meta) }
    try {
      await auditRepo.create(entry)
    } catch (error) {
      logger.error({ err: error, action, targetType, targetId: entry.targetId }, 'Could not write the activity log entry')
    }
  },

  /** GET /admin/audit: one page, newest first, with each actor's current name. */
  async list({ page, limit, actor, action }) {
    const filter = {}
    if (actor === 'system') filter.actorId = null
    else if (actor) filter.actorId = actor
    if (action) filter.action = action
    const { entries, total } = await auditRepo.list(filter, { skip: (page - 1) * limit, limit })
    const actorIds = [...new Set(entries.filter((entry) => entry.actorId).map((entry) => String(entry.actorId)))]
    const names = new Map((actorIds.length ? await userRepo.findManyByIds(actorIds) : []).map((user) => [user.id, nameOf(user)]))
    return {
      entries: entries.map((entry) => {
        const actorId = entry.actorId ? String(entry.actorId) : null
        return {
          id: String(entry._id),
          actor: actorId ? { id: actorId, name: names.get(actorId) ?? 'Deleted account' } : { id: null, name: 'System' },
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          meta: entry.meta ?? {},
          at: entry.at,
        }
      }),
      page,
      limit,
      total,
    }
  },
}
