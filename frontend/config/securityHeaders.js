/**
 * S8: the site's security headers, in one place.
 *
 * - Production: Vercel sends them from vercel.json (static JSON, so it holds a copy;
 *   test/unit/securityHeaders.test.js keeps the two equal).
 * - E2E: `vite preview` sends them (vite.config.js), so the Playwright suite runs under the
 *   real CSP and fails on any violation.
 * - The dev server sends none: Vite injects inline styles and its HMR client.
 *
 * Why each source is there:
 * - connect-src, img-src, media-src: the API (VITE_API_ORIGIN) serves the data, posters and
 *   videos. In dev and E2E the API is proxied on the site's own origin ('self').
 * - media-src https: admins can add a reference video by any external HTTPS URL; it plays
 *   straight from there (it is never fetched for the cache, so connect-src stays narrow).
 * - media-src blob:, img-src blob:/data:: recordings, cached videos and generated posters are
 *   local object URLs.
 * - style-src/font-src: Google Fonts (index.html). 'unsafe-inline' only for styles.
 * - script-src 'wasm-unsafe-eval', worker-src: ffmpeg.wasm (the admin video tool), self-hosted
 *   under /ffmpeg. No inline script, no eval.
 */
export const PRODUCTION_API_ORIGIN = 'https://api.commons.signpak.tech'

export function contentSecurityPolicy(apiOrigin = PRODUCTION_API_ORIGIN) {
  const api = String(apiOrigin || '').replace(/\/+$/, '')
  const withApi = (...sources) => ["'self'", ...(api ? [api] : []), ...sources].join(' ')
  return [
    "default-src 'self'",
    `connect-src ${withApi()}`,
    `media-src ${withApi('blob:', 'https:')}`,
    `img-src ${withApi('data:', 'blob:')}`,
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    'font-src https://fonts.gstatic.com',
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** The headers as [{ key, value }], the shape vercel.json uses. */
export function securityHeaders(apiOrigin = PRODUCTION_API_ORIGIN) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(apiOrigin) },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  ]
}
