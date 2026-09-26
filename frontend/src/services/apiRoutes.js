const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
export const API_BASE = `${API_ORIGIN}/api/v1`

const qs = (params = {}) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const apiRoutes = {
  health: () => `${API_BASE}/health`,

  auth: {
    signup: () => `${API_BASE}/auth/signup`,
    login: () => `${API_BASE}/auth/login`,
    logout: () => `${API_BASE}/auth/logout`,
    session: () => `${API_BASE}/auth/session`,
    verifyEmail: () => `${API_BASE}/auth/verify-email`,
    resendVerification: () => `${API_BASE}/auth/resend-verification`,
    forgotPassword: () => `${API_BASE}/auth/forgot-password`,
    resetPassword: () => `${API_BASE}/auth/reset-password`,
  },

  users: {
    me: () => `${API_BASE}/users/me`,
    list: () => `${API_BASE}/admin/users`,
    update: (id) => `${API_BASE}/admin/users/${id}`,
    remove: (id) => `${API_BASE}/admin/users/${id}`,
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
    list: () => `${API_BASE}/submissions`,
    create: () => `${API_BASE}/submissions`,
    recording: (id) => `${API_BASE}/submissions/${id}/recording`,
  },

  contact: {
    send: () => `${API_BASE}/contact`,
  },

  admin: {
    users: () => `${API_BASE}/admin/users`,
    restrictions: () => `${API_BASE}/admin/restrictions`,
    createRestriction: () => `${API_BASE}/admin/restrictions`,
    removeRestriction: (id) => `${API_BASE}/admin/restrictions/${id}`,
    stats: (days) => `${API_BASE}/admin/stats${qs({ days })}`,
    messages: (limit) => `${API_BASE}/admin/messages${qs({ limit })}`,
  },
}
