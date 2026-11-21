export const API_PREFIX = '/api/v1'
export const AUTH_COOKIE = 'signpak_token'

export const ROLES = { USER: 'user', ADMIN: 'admin' }
export const ROLE_LIST = Object.values(ROLES)

export const TONES = ['yellow', 'blue', 'red', 'green']
export const VIDEO_STATUS = { PUBLISHED: 'published', DRAFT: 'draft' }
export const VIDEO_STATUS_LIST = Object.values(VIDEO_STATUS)

export const POSTER_MAX_BYTES = 2 * 1024 * 1024
export const MAX_RECORDING_SECONDS = 600
// Bump when the consent notice text changes materially; contributors are then asked to accept it again.
export const CONSENT_VERSION = '2026-10-15'
// Client-reported durations are rounded, so allow a little slack when checking trim ranges.
export const TRIM_TOLERANCE_SECONDS = 0.5

// S7: every admin action written to the activity log (AuditLog). The startup admin sync uses
// admin.promote / admin.demote with the system as the actor.
export const AUDIT_ACTIONS = [
  'video.create', 'video.update', 'video.delete',
  'category.create', 'category.update', 'category.delete',
  'demo.upload', 'demo.delete',
  'user.suspend', 'user.reactivate', 'user.delete',
  'recordings.delete',
  'restriction.create', 'restriction.delete',
  'message.status',
  'admin.promote', 'admin.demote',
]
