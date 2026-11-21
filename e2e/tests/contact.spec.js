import { expect, test } from '@playwright/test'
import { apiOrigin } from '../playwright.config.js'
import { signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * Phase 4: the landing-page contact form really sends (C2), and a signed-out deletion request
 * is confirmed with the code emailed to the account (D4). The E2E API saves messages but never
 * forwards them to Web3Forms (backend/scripts/e2e-server.js).
 */

const contactForm = (page) => page.locator('form.contact-card')

/** The deletion code is emailed after the API has answered, so poll the capture hook for it. */
async function deletionCode(request, email) {
  let code
  await expect.poll(async () => {
    const response = await request.get(`${apiOrigin}/__test/emails`, { params: { to: email, purpose: 'deletion-request' } })
    code = (await response.json()).data[0]?.code
    return code
  }, { message: `no deletion-request code was captured for ${email}` }).toMatch(/^\d{6}$/)
  return code
}

test('C2: a signed-in contributor sends a contact message from the landing page', async ({ page, request }, testInfo) => {
  const email = uniqueEmail(`contact-${testInfo.project.name}`)
  await signUpThroughUi(page, request, { email })

  await page.goto('/#contact')
  const form = contactForm(page)
  await expect(form.getByLabel('Contact topic')).toHaveValue('general')
  await expect(form.getByLabel('Email address')).toHaveValue(email)
  await form.getByLabel('Your message').fill('Hello from the end-to-end suite.')
  await form.getByRole('button', { name: /send message/i }).click()

  await expect(page.getByRole('heading', { name: 'Message received.' })).toBeVisible()
})

test('D4: a signed-out deletion request is confirmed with the emailed code', async ({ page, request }, testInfo) => {
  const email = uniqueEmail(`deletion-${testInfo.project.name}`)
  await signUpThroughUi(page, request, { email })
  // Sign out: drop the session cookie, as logging out does, and load the landing page fresh.
  await page.context().clearCookies()
  await page.goto('/#contact')

  const form = contactForm(page)
  const topic = form.getByLabel('Contact topic')
  await expect(topic.locator('option')).toHaveText(['Request recording/data deletion'])
  await expect(form.getByTestId('deletion-explainer')).toContainText('six-digit code')

  await form.getByLabel('Your name').fill('Sara Ahmed')
  await form.getByLabel('Email address').fill(email)
  await form.getByLabel('Your message').fill('Please delete my recordings and contribution data.')
  await form.getByRole('button', { name: /send deletion request/i }).click()

  await expect(page).toHaveURL(/\/contact\/verify\?id=[a-f\d]{24}$/)
  await expect(page.getByRole('button', { name: /send a new code in \d+s/i })).toBeDisabled()

  await page.getByLabel('Six-digit code').fill(await deletionCode(request, email))
  await page.getByRole('button', { name: 'Confirm request' }).click()

  await expect(page.getByRole('heading', { name: 'Request verified.' })).toBeVisible()
})
