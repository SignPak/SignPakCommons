import { expect, test } from '@playwright/test'

/** Smoke test: the public landing page renders from the production build, in every engine. */
test.describe('landing page', () => {
  test('loads and shows the public sections without page errors', async ({ page }) => {
    const problems = []
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`)
    })

    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
    await expect(page.locator('#contact')).toBeAttached()
    await expect(page.locator('#policy')).toBeAttached()
    expect(problems).toEqual([])
  })

  test('the API the site talks to is healthy through the preview proxy', async ({ page }) => {
    const response = await page.request.get('/api/v1/health')
    expect(response.status()).toBe(200)
    expect((await response.json()).data.status).toBe('ok')
  })
})
