/**
 * Catalog of the real backend's endpoints (see backend/README.md), kept as one file so
 * services/api.js has a single place to read from once it stops talking to localStorage
 * and starts calling the Express API. Nothing in the app imports this yet: the mock layer
 * below is still the active implementation. Swapping in the real backend means replacing
 * each method body in services/api.js with a `fetch(apiRoutes...)` call and nothing else
 * in the app needs to change, since every screen already goes through that one file.
 */
export const API_BASE = '/api/v1'

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
  },

  users: {
    me: () => `${API_BASE}/users/me`,
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
    stats: (days) => `${API_BASE}/admin/stats${qs({ days })}`,
    messages: (limit) => `${API_BASE}/admin/messages${qs({ limit })}`,
  },
}
