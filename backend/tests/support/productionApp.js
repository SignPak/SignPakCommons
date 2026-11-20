/**
 * Starts the real app with NODE_ENV=production and a database URI that cannot be parsed, so
 * service initialization fails instantly. Used by tests/security/production-errors.test.js in
 * a child process (env.js reads the environment once per process).
 *
 * Prints "LISTENING <port>" on stdout once it accepts requests.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

Object.assign(process.env, {
  NODE_ENV: 'production',
  LOG_LEVEL: 'silent',
  // Unparseable on purpose, with a fake credential that must never reach a client.
  MONGODB_URI: 'postgres://admin:hunter2-not-real@db.internal.example:5432/signpak',
  JWT_SECRET: 'production-test-secret-production-test-secret',
  ADMIN_EMAIL: 'admin@signpak.test',
  ADMIN_PASSWORD: 'Admin@12345',
  BREVO_API_KEY: 'brevo-placeholder',
  BREVO_SENDER_EMAIL: 'auth@signpak.test',
  WEB3FORMS_ACCESS_KEY: 'web3forms-placeholder',
  TRUST_PROXY: 'true',
  CLIENT_ORIGIN: 'https://commons.example.test',
  STORAGE_DRIVER: 'local',
  ARCHIVE_STORAGE_DRIVER: 'local',
  UPLOAD_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'signpak-prod-errors-')),
})

const { default: app } = await import('../../src/app.js')
const server = app.listen(0, '127.0.0.1', () => {
  console.log(`LISTENING ${server.address().port}`)
})

process.on('SIGTERM', () => server.close(() => process.exit(0)))
