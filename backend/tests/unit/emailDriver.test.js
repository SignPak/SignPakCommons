import assert from 'node:assert/strict'
import test from 'node:test'
import '../support/helpers.js' // sets the test environment before env.js loads
import {
  captureEmailDriver,
  clearCapturedEmails,
  latestCapturedEmail,
  listCapturedEmails,
} from '../../src/services/email/captureDriver.js'

test('the capture driver records recipient, purpose and code without sending anything', async () => {
  clearCapturedEmails()
  await captureEmailDriver.sendOtp('Sara@Example.com', '123456', 'email-verification')

  const [entry] = listCapturedEmails()
  assert.equal(entry.to, 'sara@example.com') // normalised, so a lookup by email always matches
  assert.equal(entry.purpose, 'email-verification')
  assert.equal(entry.code, '123456')
  assert.ok(Date.parse(entry.at) > 0)
})

test('captured codes can be filtered by recipient and purpose, newest first', async () => {
  clearCapturedEmails()
  await captureEmailDriver.sendOtp('one@example.com', '111111', 'email-verification')
  await captureEmailDriver.sendOtp('two@example.com', '222222', 'email-verification')
  await captureEmailDriver.sendOtp('one@example.com', '333333', 'password-reset')
  await captureEmailDriver.sendOtp('one@example.com', '444444', 'email-verification')

  assert.deepEqual(listCapturedEmails({ to: 'one@example.com' }).map((item) => item.code), ['444444', '333333', '111111'])
  assert.equal(latestCapturedEmail('one@example.com', 'email-verification').code, '444444')
  assert.equal(latestCapturedEmail('one@example.com', 'password-reset').code, '333333')
  assert.equal(latestCapturedEmail('nobody@example.com', 'email-verification'), undefined)
})

test('the capture store keeps only the last 100 codes and can be cleared', async () => {
  clearCapturedEmails()
  for (let index = 0; index < 120; index += 1) {
    await captureEmailDriver.sendOtp(`user${index}@example.com`, String(index).padStart(6, '0'), 'email-verification')
  }

  const all = listCapturedEmails()
  assert.equal(all.length, 100)
  assert.equal(all[0].code, '000119') // newest kept
  assert.equal(latestCapturedEmail('user0@example.com', 'email-verification'), undefined) // oldest dropped

  clearCapturedEmails()
  assert.deepEqual(listCapturedEmails(), [])
})

test('the test environment selects the capture driver and brevo stays the default elsewhere', async () => {
  const { emailService } = await import('../../src/services/email/index.js')
  const { env } = await import('../../src/config/env.js')
  const { brevoEmailDriver } = await import('../../src/services/email/brevoDriver.js')

  assert.equal(env.EMAIL_DRIVER, 'capture')
  assert.equal(emailService.driverName, 'capture')
  assert.equal(brevoEmailDriver.name, 'brevo')

  // The schema default, independent of this process's environment.
  const schemaDefault = await import('node:child_process').then(({ execFileSync }) => execFileSync(
    process.execPath,
    ['-e', `
      process.env.NODE_ENV = 'development'
      delete process.env.EMAIL_DRIVER
      process.env.MONGODB_URI = 'mongodb://127.0.0.1/unused'
      process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'
      process.env.ADMIN_EMAIL = 'admin@signpak.test'
      process.env.ADMIN_PASSWORD = 'Admin@12345'
      const { env } = await import('./src/config/env.js')
      console.log(env.EMAIL_DRIVER)
    `.trim()],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ))
  assert.equal(schemaDefault.trim(), 'brevo')
})

test('authService sends its codes through the email driver', async () => {
  const { authService } = await import('../../src/services/authService.js')
  clearCapturedEmails()
  await authService.sendOTPEmail('driver-check@example.com', '987654', 'password-reset')
  assert.equal(latestCapturedEmail('driver-check@example.com', 'password-reset').code, '987654')
})
