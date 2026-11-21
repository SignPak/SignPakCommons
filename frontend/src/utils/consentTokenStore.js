/**
 * B4: the sign-up consent token survives a page reload. VerifyEmail saves it here as well as in
 * the navigation state; Consent reads the state first, then this. It lives in sessionStorage
 * (this tab only, gone when the tab closes) with the token's own expiry, read from the JWT's
 * `exp` without verifying it: the server checks the token, this only stops a stale one being
 * offered. Every access is guarded, so blocked storage just falls back to the navigation state.
 */
const KEY = 'signpak:consent-token'

function expiryOf(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export const consentTokenStore = {
  save(token) {
    const expiresAt = expiryOf(token)
    if (!expiresAt) return
    try { sessionStorage.setItem(KEY, JSON.stringify({ token, expiresAt })) } catch { /* storage unavailable */ }
  },

  /** The saved token, or null when there is none, it has expired, or storage is unavailable. */
  read(now = Date.now()) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null')
      if (saved?.token && saved.expiresAt > now) return saved.token
      if (saved) sessionStorage.removeItem(KEY)
    } catch { /* storage unavailable or corrupt */ }
    return null
  },

  clear() {
    try { sessionStorage.removeItem(KEY) } catch { /* storage unavailable */ }
  },
}
