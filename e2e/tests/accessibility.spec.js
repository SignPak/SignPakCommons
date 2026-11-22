import AxeBuilder from '@axe-core/playwright'
import { expect, prepareContext, test } from '../support/test.js'
import { apiOrigin } from '../playwright.config.js'
import { signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * SRS C.3 / QA-20 (FIX-PLAN Phase 9 item 6): axe checks the main pages against WCAG 2.1 A and
 * AA, in the light and the dark theme, and fails on any serious or critical problem.
 *
 * Pages: landing; library (home and a category); the watch/record page; the recording editor;
 * every admin tab. The editor needs a recording, so it is checked in Chromium, the one engine
 * with a fake camera here (playwright.config.js).
 */

const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345' }
const THEMES = ['light', 'dark']
const ADMIN_PAGES = ['/admin', '/admin/users', '/admin/videos', '/admin/categories', '/admin/submissions', '/admin/messages', '/admin/activity']
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 7)])

/** A category with one published video, so the library and watch pages have content. */
async function libraryContent(playwright, label) {
  const admin = await playwright.request.newContext({ baseURL: apiOrigin })
  expect((await admin.post('/api/v1/auth/login', { data: ADMIN })).status()).toBe(200)
  const category = (await (await admin.post('/api/v1/categories', { data: { label: `A11y ${label}`, tone: 'yellow' } })).json()).data
  const made = await admin.post('/api/v1/videos', {
    multipart: { title: `Greeting ${label}`, categoryId: category.id, durationSec: '3', status: 'published', video: { name: 'video.webm', mimeType: 'video/webm', buffer: webm() } },
  })
  expect(made.status(), await made.text()).toBe(201)
  const video = (await made.json()).data
  await admin.dispose()
  return { category, video }
}

async function useTheme(page, theme) {
  await page.evaluate((value) => localStorage.setItem('signpak:theme', value), theme)
}

/** Serious and critical axe violations on the current page, as short readable lines. */
async function seriousProblems(page) {
  // Wait until the page itself has rendered, not a lazy-loading or session-check line.
  await expect(page.locator('main').first()).toBeVisible()
  await expect(page.locator('.boot')).toHaveCount(0)
  // Forms stay disabled until the session check returns (e.g. the landing page's contact form).
  await expect(page.getByText('Checking your session…')).toHaveCount(0)
  // And until the page's own data has loaded: while a "Loading …" line shows, its controls are
  // disabled and fade in afterwards (Admin → Activity's pager was measured mid-fade in WebKit).
  await expect(page.getByText(/^Loading/).filter({ visible: true })).toHaveCount(0)
  // And until transitions have finished (e.g. a button fading in once the session is checked),
  // so colour contrast is measured on what stays on screen. Endless animations are ignored.
  await page.waitForFunction(() => document.getAnimations().every((animation) =>
    animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity))
  // preload: false — otherwise axe fetches cross-origin stylesheets (Google Fonts) to build its
  // CSS model, which the site's CSP rightly blocks (connect-src) and the CSP fixture reports.
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).options({ preload: false }).analyze()
  return violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .flatMap((violation) => violation.nodes.slice(0, 3).map((node) => `${violation.id} (${violation.impact}) ${node.target.join(' ')}: ${node.failureSummary?.split('\n').slice(1).join(' ').trim()} — ${node.html.slice(0, 160)}`))
}

async function checkPages(page, paths, label) {
  const found = {}
  for (const theme of THEMES) {
    await useTheme(page, theme)
    for (const path of paths) {
      await page.goto(path)
      const problems = await seriousProblems(page)
      if (problems.length) found[`${theme} ${path}`] = problems
    }
  }
  expect(found, `serious accessibility problems (${label})`).toEqual({})
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  test('QA-20: the landing page, the library and the watch page have no serious problems', async ({ page, request, playwright }, testInfo) => {
    test.setTimeout(120_000)
    const { category, video } = await libraryContent(playwright, `${testInfo.project.name}-${Date.now()}`)
    await page.goto('/')
    await checkPages(page, ['/'], 'signed out')
    await signUpThroughUi(page, request, { email: uniqueEmail(`a11y-${testInfo.project.name}`) })
    await checkPages(page, ['/home', `/library/${category.id}`, `/watch?v=${video.id}`], 'contributor')
  })

  test('QA-20: the recording editor has no serious problems', async ({ page, request, playwright, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Recording needs the fake camera, which only the Chromium project has (playwright.config.js).')
    test.setTimeout(120_000)
    const { video } = await libraryContent(playwright, `${testInfo.project.name}-editor-${Date.now()}`)
    await signUpThroughUi(page, request, { email: uniqueEmail(`a11y-editor-${testInfo.project.name}`) })
    for (const theme of THEMES) {
      await useTheme(page, theme)
      await page.goto(`/watch?v=${video.id}`)
      await page.getByRole('button', { name: /Start recording|Record again/ }).click()
      await page.getByRole('button', { name: /Stop recording/ }).click({ timeout: 15_000 })
      await page.getByRole('button', { name: /Save and edit video/ }).click()
      await expect(page).toHaveURL(/\/watch\/edit/)
      expect(await seriousProblems(page), `serious accessibility problems (editor, ${theme})`).toEqual([])
    }
  })

  test('QA-20: every admin tab has no serious problems', async ({ browser }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext()
    await prepareContext(context)
    const page = await context.newPage()
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
    await page.getByLabel('Email address').fill(ADMIN.email)
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password)
    await page.getByRole('button', { name: /log in/i }).click()
    await expect(page).not.toHaveURL(/\/login/)
    await checkPages(page, ADMIN_PAGES, 'admin')
    await context.close()
  })
})
