const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
export const API_BASE = `${API_ORIGIN}/api/v1`

const qs = (params = {}) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const apiRoutes = {
  health: () => `${API_BASE}/health`,
  public: {
    stats: () => `${API_BASE}/public/stats`,
  },

  auth: {
    signup: () => `${API_BASE}/auth/signup`,
    login: () => `${API_BASE}/auth/login`,
    logout: () => `${API_BASE}/auth/logout`,
    session: () => `${API_BASE}/auth/session`,
    verifyEmail: () => `${API_BASE}/auth/verify-email`,
    consent: () => `${API_BASE}/auth/consent`,
    declineConsent: () => `${API_BASE}/auth/decline-consent`,
    resendVerification: () => `${API_BASE}/auth/resend-verification`,
    forgotPassword: () => `${API_BASE}/auth/forgot-password`,
    resetPassword: () => `${API_BASE}/auth/reset-password`,
  },

  users: {
    me: () => `${API_BASE}/users/me`,
    removeMe: () => `${API_BASE}/users/me`,
    consent: () => `${API_BASE}/users/me/consent`,
    password: () => `${API_BASE}/users/me/password`,
    list: ({ limit, cursor, role, q } = {}) => `${API_BASE}/admin/users${qs({ limit, cursor, role, q })}`,
    update: (id) => `${API_BASE}/admin/users/${id}`,
    remove: (id, { withRecordings } = {}) => `${API_BASE}/admin/users/${id}${qs({ withRecordings: withRecordings ? 'true' : undefined })}`,
  },

  categories: {
    list: () => `${API_BASE}/categories`,
    create: () => `${API_BASE}/categories`,
    update: (id) => `${API_BASE}/categories/${id}`,
    remove: (id) => `${API_BASE}/categories/${id}`,
  },

  videos: {
    list: () => `${API_BASE}/videos`,
    get: (id) => `${API_BASE}/videos/${id}`,
    poster: (id) => `${API_BASE}/videos/${id}/poster`,
    file: (id) => `${API_BASE}/videos/${id}/file`,
    create: () => `${API_BASE}/videos`,
    update: (id) => `${API_BASE}/videos/${id}`,
    remove: (id) => `${API_BASE}/videos/${id}`,
  },

  demoVideo: {
    get: () => `${API_BASE}/demo-video`,
    file: () => `${API_BASE}/demo-video/file`,
    upload: () => `${API_BASE}/demo-video`,
    remove: () => `${API_BASE}/demo-video`,
  },

  submissions: {
    list: ({ mine, limit, cursor } = {}) => `${API_BASE}/submissions${qs({ mine, limit, cursor })}`,
    create: () => `${API_BASE}/submissions`,
    recording: (id) => `${API_BASE}/submissions/${id}/recording`,
  },

  contact: {
    send: () => `${API_BASE}/contact`,
    verify: (id) => `${API_BASE}/contact/${encodeURIComponent(id)}/verify`,
    resend: (id) => `${API_BASE}/contact/${encodeURIComponent(id)}/resend`,
  },

  admin: {
    users: () => `${API_BASE}/admin/users`,
    restrictions: () => `${API_BASE}/admin/restrictions`,
    createRestriction: () => `${API_BASE}/admin/restrictions`,
    removeRestriction: (id) => `${API_BASE}/admin/restrictions/${id}`,
    stats: ({ days, userId, categoryId } = {}) => `${API_BASE}/admin/stats${qs({ days, userId, categoryId })}`,
    messages: ({ limit, topic, status, verified } = {}) => `${API_BASE}/admin/messages${qs({ limit, topic, status, verified })}`,
    message: (id) => `${API_BASE}/admin/messages/${encodeURIComponent(id)}`,
    // C3: deletion requests.
    userSubmissions: (userId, { limit, cursor } = {}) => `${API_BASE}/admin/users/${encodeURIComponent(userId)}/submissions${qs({ limit, cursor })}`,
    removeUserSubmissions: (userId, { requestMessageId } = {}) => `${API_BASE}/admin/users/${encodeURIComponent(userId)}/submissions${qs({ requestMessageId })}`,
    deletionLookup: ({ messageId, email } = {}) => `${API_BASE}/admin/deletion-lookup${qs({ messageId, email })}`,
    // B5: every submission, a page at a time, and the export for the ML team.
    submissions: ({ categoryId, videoId, userId, from, to, limit, cursor } = {}) => `${API_BASE}/admin/submissions${qs({ categoryId, videoId, userId, from, to, limit, cursor })}`,
    exportSubmissions: ({ categoryId, videoId, userId, from, to, format } = {}) => `${API_BASE}/admin/submissions/export${qs({ format, categoryId, videoId, userId, from, to })}`,
    // S7: the activity log.
    audit: ({ page, limit, actor, action } = {}) => `${API_BASE}/admin/audit${qs({ page, limit, actor, action })}`,
  },
}
