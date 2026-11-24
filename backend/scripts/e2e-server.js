#!/usr/bin/env node
/**
 * The API the Playwright suite talks to: in-memory MongoDB, local storage in a throwaway
 * folder, the capture email driver, and the /__test/emails hook turned on.
 *
 * Playwright starts this through its `webServer` config (see e2e/playwright.config.js); it
 * lives in backend/ so it can reuse this package's mongodb-memory-server binary instead of
 * downloading another copy under e2e/.
 *
 * Nothing here runs in production: NODE_ENV is forced to test, and env.js refuses to start
 * with E2E_TEST_HOOKS or EMAIL_DRIVER=capture when NODE_ENV=production.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const PORT = Number(process.env.E2E_API_PORT || 5099)
// '::' listens on IPv6 and IPv4 loopback alike (the cross-host E2E names resolve to both).
const HOST = process.env.E2E_API_HOST || '127.0.0.1'
const PREVIEW_ORIGINS = process.env.E2E_CLIENT_ORIGIN || 'http://127.0.0.1:4173,http://localhost:4173'

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signpak-e2e-'))

Object.assign(process.env, {
  NODE_ENV: 'test',
  E2E_TEST_HOOKS: 'true',
  EMAIL_DRIVER: 'capture',
  STORAGE_DRIVER: 'local',
  ARCHIVE_STORAGE_DRIVER: 'local',
  UPLOAD_DIR: uploadDir,
  PORT: String(PORT),
  CLIENT_ORIGIN: PREVIEW_ORIGINS,
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'lax',
  RATE_LIMIT_ENABLED: 'false',
  BCRYPT_ROUNDS: '4',
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-123456',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@signpak.test',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@12345',
  // S7: a second admin from the list. The account is seeded below as a normal, verified user,
  // as if a team member had signed up, so the real startup sync is what promotes it.
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin2@signpak.test',
  // Short enough that an E2E test can wait out a per-video cooldown.
  SUBMISSION_COOLDOWN_MS: process.env.SUBMISSION_COOLDOWN_MS || '2000',
  // Every browser in the suite connects from 127.0.0.1, so the per-sender deletion-request
  // limit (2 a day in production) would stop the second engine's run.
  CONTACT_SENDER_DAILY_LIMIT: process.env.CONTACT_SENDER_DAILY_LIMIT || '50',
  MONGODB_URI: 'mongodb://placeholder/unused', // replaced below, before anything connects
})

const { MongoMemoryServer } = await import('mongodb-memory-server')
const memory = await MongoMemoryServer.create()
process.env.MONGODB_URI = memory.getUri('signpak_e2e')

const [{ default: app }, { connectDb, disconnectDb }, { storageService }, { authService }, { contactService }, { default: mongoose }] =
  await Promise.all([
    import('../src/app.js'),
    import('../src/config/db.js'),
    import('../src/services/storage/index.js'),
    import('../src/services/authService.js'),
    import('../src/services/contactService.js'),
    import('mongoose'),
  ])

// Contact messages are saved as usual but never forwarded to Web3Forms from a test run.
contactService.deliver = async ({ topic, verification }) => {
  console.log(`[e2e] contact message not forwarded: ${topic}${verification ? ` (${verification})` : ''}`)
}

await connectDb(process.env.MONGODB_URI)
await mongoose.connection.dropDatabase()
await Promise.all(Object.values(mongoose.models).map((model) => model.init()))
await storageService.init()
const { default: bcrypt } = await import('bcrypt')
await mongoose.models.User.create({
  email: 'admin2@signpak.test', firstName: 'Nida', surname: 'Second', role: 'user', emailVerified: true,
  passwordHash: await bcrypt.hash(process.env.E2E_ADMIN2_PASSWORD || 'Admin2@12345', 4),
})
// Phase 10: the contributor the @smoke specs sign in as when they run locally (e2e/tests/smoke.spec.js).
// Against production they use a real test account from SMOKE_EMAIL / SMOKE_PASSWORD instead.
const { CONSENT_VERSION } = await import('../src/config/constants.js')
await mongoose.models.User.create({
  email: 'smoke@signpak.test', firstName: 'Sana', surname: 'Smoke', role: 'user', emailVerified: true,
  passwordHash: await bcrypt.hash('Smoke@12345', 4),
  consent: { acceptedAt: new Date(), version: CONSENT_VERSION },
})
await authService.ensureAdminFromEnv()

const server = app.listen(PORT, HOST, () => {
  console.log(`[e2e] API listening on ${HOST}:${PORT}`)
  console.log(`[e2e] uploads in ${uploadDir}`)
  console.log(`[e2e] allowed client origins: ${PREVIEW_ORIGINS}`)
})

let closing = false
const shutdown = async (signal) => {
  if (closing) return
  closing = true
  console.log(`[e2e] ${signal}: shutting down`)
  await new Promise((resolve) => server.close(resolve))
  await disconnectDb().catch(() => {})
  await memory.stop().catch(() => {})
  fs.rmSync(uploadDir, { recursive: true, force: true })
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, () => { shutdown(signal) })
}
