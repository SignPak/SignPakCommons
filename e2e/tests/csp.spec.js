import { expect, test } from '../support/test.js'

/**
 * S8: the site's security headers, as `vite preview` serves them (the same set as vercel.json;
 * frontend/test/unit/securityHeaders.test.js keeps the two equal). Every other spec runs under
 * this CSP too and fails on any violation (support/test.js).
 */

test.describe('S8: security headers and CSP', () => {
  test('S8: every page and file is served with the CSP and the other security headers', async ({ page }) => {
    for (const path of ['/', '/login', '/admin/videos', '/theme-init.js', '/ffmpeg/ffmpeg-core.js']) {
      const response = await page.request.get(path)
      expect(response.status(), path).toBe(200)
      const headers = response.headers()
      expect(headers['content-security-policy'], path).toContain("default-src 'self'")
      expect(headers['content-security-policy'], path).toContain("script-src 'self' 'wasm-unsafe-eval'")
      expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'")
      expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
      expect(headers['x-content-type-options'], path).toBe('nosniff')
      expect(headers['permissions-policy'], path).toBe('camera=(self), microphone=(), geolocation=()')
    }
  })

  test.describe('the fixture catches violations', () => {
    test.use({ allowCspViolations: true })

    test('S8: an injected inline script is blocked, and the violation is reported', async ({ page, cspViolations }) => {
      await page.goto('/')
      await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
      expect(cspViolations).toEqual([])
      await page.evaluate(() => {
        const script = document.createElement('script')
        script.textContent = 'window.__inlineRan = true'
        document.head.append(script)
      })
      expect(await page.evaluate(() => window.__inlineRan)).toBeUndefined()
      await expect.poll(() => cspViolations.some((v) => /^script-src/.test(v.directive || '') || /inline/i.test(v.console || ''))).toBe(true)
    })
  })

  test('S8: the theme is still set before the app runs (public/theme-init.js under the CSP)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('signpak:theme', 'dark'))
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#00401a')
  })

  test('S8: the sign-in background photo comes from the site itself', async ({ page }) => {
    const photo = page.waitForResponse((response) => response.url().endsWith('/images/auth-background.jpg'))
    await page.goto('/login')
    const response = await photo
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/^image\/jpeg/)
  })
})
