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
export const CONSENT_VERSION = '2026-10'
// Client-reported durations are rounded, so allow a little slack when checking trim ranges.
export const TRIM_TOLERANCE_SECONDS = 0.5
