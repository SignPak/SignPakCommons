import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PRODUCTION_API_ORIGIN, contentSecurityPolicy, securityHeaders } from '../../config/securityHeaders.js'
import viteConfig from '../../vite.config.js'

/**
 * S8: the site's security headers. Vercel serves them in production (vercel.json); `vite
 * preview` serves the same ones to the Playwright suite, so E2E runs under the real CSP. Both
 * come from config/securityHeaders.js, and these tests keep the static vercel.json in step.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const directives = (csp) => Object.fromEntries(csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
  const [name, ...values] = part.split(/\s+/)
  return [name, values]
}))

describe('S8: security headers', () => {
  it('S8: vercel.json sends exactly securityHeaders() for the production API, on every path', () => {
    const entry = vercel.headers.find((rule) => rule.source === '/(.*)')
    expect(entry, 'a rule for every path, the ffmpeg worker script included').toBeTruthy()
    expect(entry.headers).toEqual(securityHeaders(PRODUCTION_API_ORIGIN))
    expect(PRODUCTION_API_ORIGIN).toBe('https://api.commons.signpak.tech')
  })

  it('S8: vite preview (the E2E server) sends the same headers', () => {
    const expected = Object.fromEntries(securityHeaders(process.env.VITE_API_ORIGIN || PRODUCTION_API_ORIGIN).map(({ key, value }) => [key, value]))
    expect(viteConfig.preview.headers).toEqual(expected)
    expect(viteConfig.server.headers, 'the dev server has no CSP: Vite injects inline styles and HMR').toBeUndefined()
  })

  it('S8: the CSP allows only the site, the API and the listed hosts', () => {
    const csp = directives(contentSecurityPolicy(PRODUCTION_API_ORIGIN))
    expect(csp).toEqual({
      'default-src': ["'self'"],
      'connect-src': ["'self'", 'https://api.commons.signpak.tech'],
      'media-src': ["'self'", 'https://api.commons.signpak.tech', 'blob:', 'https:'],
      'img-src': ["'self'", 'https://api.commons.signpak.tech', 'data:', 'blob:'],
      'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      'font-src': ['https://fonts.gstatic.com'],
      'script-src': ["'self'", "'wasm-unsafe-eval'"],
      'worker-src': ["'self'", 'blob:'],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
    })
  })

  it('S8: no script source allows inline code, eval or a CDN', () => {
    const csp = contentSecurityPolicy(PRODUCTION_API_ORIGIN)
    const scripts = directives(csp)['script-src']
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
    expect(csp).not.toMatch(/jsdelivr|unpkg|unsplash/)
  })

  it('S8: the other headers', () => {
    const headers = Object.fromEntries(securityHeaders(PRODUCTION_API_ORIGIN).map(({ key, value }) => [key, value]))
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Permissions-Policy']).toBe('camera=(self), microphone=(), geolocation=()')
  })

  it('S8: another API origin (the cross-host E2E build) replaces the production one', () => {
    const csp = directives(contentSecurityPolicy('http://api.localtest.me:5099/'))
    expect(csp['connect-src']).toEqual(["'self'", 'http://api.localtest.me:5099'])
    expect(csp['img-src']).toContain('http://api.localtest.me:5099')
    expect(csp['media-src']).toContain('http://api.localtest.me:5099')
  })

  it('S8: index.html has no inline script (the theme script is public/theme-init.js)', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    expect(scripts.length).toBeGreaterThan(0)
    for (const [, attributes, body] of scripts) {
      expect(attributes, 'every script has a src').toMatch(/\bsrc=/)
      expect(body.trim()).toBe('')
    }
    expect(html).toMatch(/<script src="\/theme-init\.js"><\/script>/)
  })
})
