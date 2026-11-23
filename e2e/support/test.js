import { test as base, expect } from '@playwright/test'

/**
 * The suite's `test`: Playwright's, plus two automatic fixtures.
 *
 * 1. Off the internet. The site loads Google Fonts, and `page.goto` waits for the page's `load`
 *    event, which waits for those too. A slow or stalled third-party request then stalls the
 *    navigation until the test times out: a failure that has nothing to do with the code under
 *    test (seen locally while checking the Phase 6 CI fix). These hosts are answered locally,
 *    with the same content types a browser expects, so nothing fails to load and nothing is
 *    logged. (Since Phase 9 the auth background photo is served by the site itself.)
 *
 * 2. S8: under the CSP. `vite preview` sends the production headers (frontend/vite.config.js),
 *    and every test fails if the browser reports any CSP violation: a `securitypolicyviolation`
 *    event in a page, or a console message about one. A test that triggers one on purpose sets
 *    `test.use({ allowCspViolations: true })` and reads the `cspViolations` fixture.
 *
 * A test that opens another browser context calls `prepareContext(context)` on it, so the same
 * applies there.
 */

const THIRD_PARTY = [
  { pattern: /^https:\/\/fonts\.googleapis\.com\//, reply: { status: 200, contentType: 'text/css', body: '' } },
  { pattern: /^https:\/\/fonts\.gstatic\.com\//, reply: { status: 404, contentType: 'text/plain', body: '' } },
]

// Console wording differs by engine: Chromium and WebKit say "Refused to …" and name the
// Content Security Policy; Firefox starts with "Content-Security-Policy:".
const CSP_CONSOLE = /Content[- ]Security[- ]Policy|Refused to (load|execute|connect|apply|create|frame|evaluate)/i

// The violations of the test that is running (workers: 1, so one test at a time per process).
let currentViolations = null

async function routeThirdParty(context) {
  for (const { pattern, reply } of THIRD_PARTY) {
    await context.route(pattern, (route) => route.fulfill(reply))
  }
}

async function watchCsp(context) {
  const record = (violation) => currentViolations?.push(violation)
  await context.exposeBinding('__reportCspViolation', ({ page }, violation) => record({ ...violation, page: page?.url() }))
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__reportCspViolation?.({
        directive: event.effectiveDirective || event.violatedDirective,
        blocked: event.blockedURI,
        source: event.sourceFile,
        line: event.lineNumber,
        sample: event.sample,
      })
    })
  })
  context.on('console', (message) => {
    if (CSP_CONSOLE.test(message.text())) record({ console: message.text(), page: message.page()?.url() })
  })
}

/** Gives a context the test opened itself the same set-up as the default one. */
export async function prepareContext(context) {
  await routeThirdParty(context)
  await watchCsp(context)
}

export const test = base.extend({
  allowCspViolations: [false, { option: true }],

  cspViolations: [async ({ allowCspViolations }, use) => {
    const violations = []
    currentViolations = violations
    await use(violations)
    currentViolations = null
    if (!allowCspViolations) expect(violations, 'CSP violations reported by the browser').toEqual([])
  }, { auto: true }],

  // Depends on cspViolations, so the list exists before any page of the default context loads.
  preparedContext: [async ({ context, cspViolations }, use) => {
    void cspViolations
    await prepareContext(context)
    await use()
  }, { auto: true }],
})

export { expect }
