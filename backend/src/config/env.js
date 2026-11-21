import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { z } from 'zod'

const bool = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
])

const explicitEnv = { ...process.env }
const dotEnvPath = path.resolve(process.cwd(), '.env')
const dotEnv = fs.existsSync(dotEnvPath)
  ? config({ path: dotEnvPath, override: false }).parsed ?? {}
  : {}

const mergedEnv = { ...dotEnv, ...explicitEnv }
const isTest = (explicitEnv.NODE_ENV ?? dotEnv.NODE_ENV ?? 'development') === 'test'

const testSafeEnv = isTest
  ? {
      ...mergedEnv,
      COOKIE_SECURE: explicitEnv.COOKIE_SECURE ?? 'false',
      COOKIE_SAMESITE: explicitEnv.COOKIE_SAMESITE ?? 'lax',
      STORAGE_DRIVER: explicitEnv.STORAGE_DRIVER ?? 'local',
      ARCHIVE_STORAGE_DRIVER: explicitEnv.ARCHIVE_STORAGE_DRIVER ?? 'local',
      RATE_LIMIT_ENABLED: explicitEnv.RATE_LIMIT_ENABLED ?? 'false',
      EMAIL_DRIVER: explicitEnv.EMAIL_DRIVER ?? 'capture',
    }
  : mergedEnv

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  // Address the server listens on. Unset: 127.0.0.1 in production (only Nginx on the same
  // machine can connect, so nobody can bypass it and forge X-Forwarded-For), 0.0.0.0 elsewhere.
  HOST: z.string().trim().min(1, 'HOST must be an address such as 127.0.0.1; leave it unset for the default.').optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: bool.default(false),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Comma-separated list of browser origins allowed to call the API with cookies.
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_DAYS: z.coerce.number().positive().default(7),
  // C3: key for the email hashes in DeletionLog and DeletedAccount. Never change it once set:
  // old rows could no longer be matched. Required in production; see the default below.
  EMAIL_HASH_SECRET: z.preprocess((value) => (value === '' ? undefined : value), z.string().min(32, 'EMAIL_HASH_SECRET must be at least 32 characters.').optional()),
  COOKIE_SECURE: bool.optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // brevo sends real mail; capture keeps codes in memory for the test and E2E suites only.
  EMAIL_DRIVER: z.enum(['brevo', 'capture']).default('brevo'),
  // Mounts GET /__test/emails. Test environments only; rejected in production below.
  E2E_TEST_HOOKS: bool.default(false),

  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email('BREVO_SENDER_EMAIL must be a valid email').optional().or(z.literal('')),
  BREVO_SENDER_NAME: z.string().min(1).default('SignPak Commons'),
  // FIX-PLAN section 0: codes last 10 minutes, matching the SRS.
  AUTH_OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  AUTH_OTP_RESEND_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),
  AUTH_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  // S2 / SE-4: wrong passwords before an account is locked, and for how long.
  AUTH_LOCKOUT_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

  WEB3FORMS_ACCESS_KEY: z.string().optional(),
  CONTACT_DAILY_LIMIT: z.coerce.number().int().min(1).default(25),
  CONTACT_USER_DAILY_LIMIT: z.coerce.number().int().min(1).default(1),
  // S4: signed-out deletion requests per IP and per device each UTC day.
  CONTACT_SENDER_DAILY_LIMIT: z.coerce.number().int().min(1).default(2),
  // S4: deletion-request code emails to one address each UTC day, across all requests.
  CONTACT_CODE_EMAILS_PER_DAY: z.coerce.number().int().min(1).default(5),

  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters').max(72),
  ADMIN_FIRST_NAME: z.string().min(1).default('Admin'),
  ADMIN_SURNAME: z.string().min(1).default('Signpak'),
  // S7 / D5: more admin accounts, comma-separated. Each must already be a finished sign-up;
  // they are promoted (and admins not listed are demoted) when the server starts.
  ADMIN_EMAILS: z.string().optional().default('')
    .transform((value) => [...new Set(value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.email('Each ADMIN_EMAILS entry must be a valid email address.'))),

  STORAGE_DRIVER: z.enum(['local', 'gdrive']).default('local'),
  ARCHIVE_STORAGE_DRIVER: z.enum(['local', 'gdrive']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_ARCHIVE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_ARCHIVE_DRIVE_FOLDER_ID: z.string().optional(),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().positive().default(90),
  MAX_RECORDING_UPLOAD_MB: z.coerce.number().positive().default(100),

  RATE_LIMIT_ENABLED: bool.default(true),
  SUBMISSION_COOLDOWN_MS: z.coerce.number().int().positive().default(30_000),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).superRefine((data, context) => {
  if (Boolean(data.UPSTASH_REDIS_REST_URL) !== Boolean(data.UPSTASH_REDIS_REST_TOKEN)) {
    context.addIssue({
      code: 'custom',
      path: ['UPSTASH_REDIS_REST_URL'],
      message: 'Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable the Redis cache.',
    })
  }

  if (data.NODE_ENV === 'production') {
    if (data.E2E_TEST_HOOKS) {
      context.addIssue({ code: 'custom', path: ['E2E_TEST_HOOKS'], message: 'Test hooks must never be enabled in production. Remove E2E_TEST_HOOKS.' })
    }
    if (data.EMAIL_DRIVER === 'capture') {
      context.addIssue({ code: 'custom', path: ['EMAIL_DRIVER'], message: 'The capture driver never delivers mail. Use EMAIL_DRIVER=brevo in production.' })
    }
    if (!data.BREVO_API_KEY) {
      context.addIssue({ code: 'custom', path: ['BREVO_API_KEY'], message: 'Required in production for email verification and password reset.' })
    }
    if (!data.BREVO_SENDER_EMAIL) {
      context.addIssue({ code: 'custom', path: ['BREVO_SENDER_EMAIL'], message: 'Required in production; use a verified Brevo sender address.' })
    }
    if (!data.EMAIL_HASH_SECRET) {
      context.addIssue({ code: 'custom', path: ['EMAIL_HASH_SECRET'], message: 'Required in production for deletion records. Generate it once with `openssl rand -hex 32` and never change it.' })
    }
    if (!data.WEB3FORMS_ACCESS_KEY) {
      context.addIssue({ code: 'custom', path: ['WEB3FORMS_ACCESS_KEY'], message: 'Required in production to deliver contact messages.' })
    }
  }
  const hasOauth = (clientId, clientSecret, refreshToken) =>
    Boolean(clientId && clientSecret && refreshToken)
  const baseOauth = hasOauth(
    data.GOOGLE_OAUTH_CLIENT_ID,
    data.GOOGLE_OAUTH_CLIENT_SECRET,
    data.GOOGLE_OAUTH_REFRESH_TOKEN
  )
  const archiveOauth = hasOauth(
    data.GOOGLE_ARCHIVE_OAUTH_CLIENT_ID,
    data.GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET,
    data.GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN
  )
  const hasAny = (...values) => values.some(Boolean)

  for (const [prefix, values] of [
    ['GOOGLE_OAUTH', [
      data.GOOGLE_OAUTH_CLIENT_ID,
      data.GOOGLE_OAUTH_CLIENT_SECRET,
      data.GOOGLE_OAUTH_REFRESH_TOKEN,
    ]],
    ['GOOGLE_ARCHIVE_OAUTH', [
      data.GOOGLE_ARCHIVE_OAUTH_CLIENT_ID,
      data.GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET,
      data.GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN,
    ]],
  ]) {
    if (hasAny(...values) && !values.every(Boolean)) {
      context.addIssue({
        code: 'custom',
        path: [`${prefix}_CLIENT_ID`],
        message: 'Set all three OAuth client ID, client secret, and refresh token variables together.',
      })
    }
  }

  if (data.STORAGE_DRIVER === 'gdrive') {
    if (!baseOauth && !data.GOOGLE_SERVICE_ACCOUNT_JSON) {
      context.addIssue({ code: 'custom', path: ['GOOGLE_OAUTH_REFRESH_TOKEN'], message: 'Set the Google OAuth variables or a service-account JSON.' })
    }
    if (!data.GOOGLE_DRIVE_FOLDER_ID) {
      context.addIssue({ code: 'custom', path: ['GOOGLE_DRIVE_FOLDER_ID'], message: 'Required when STORAGE_DRIVER=gdrive.' })
    }
  }

  if (data.ARCHIVE_STORAGE_DRIVER === 'gdrive') {
    const archiveHasCredentials =
      archiveOauth ||
      data.GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON ||
      baseOauth ||
      data.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!archiveHasCredentials) {
      context.addIssue({ code: 'custom', path: ['GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN'], message: 'Set the archive Google OAuth variables, shared Google credentials, or an archive service-account JSON.' })
    }
    if (!data.GOOGLE_ARCHIVE_DRIVE_FOLDER_ID && !data.GOOGLE_DRIVE_FOLDER_ID) {
      context.addIssue({ code: 'custom', path: ['GOOGLE_ARCHIVE_DRIVE_FOLDER_ID'], message: 'Required when ARCHIVE_STORAGE_DRIVER=gdrive and no shared Drive folder is configured.' })
    }
  }
})

const parsed = schema.safeParse(testSafeEnv)

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
  console.error('\n==================================================')
  console.error('FATAL ENVIRONMENT CONFIGURATION ERROR:')
  console.error(lines.join('\n'))
  console.error('==================================================\n')
  process.exit(1)
}

const data = parsed.data

export const env = Object.freeze({
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  HOST: data.HOST ?? (data.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
  // Outside production a fixed value keeps existing development .env files working.
  EMAIL_HASH_SECRET: data.EMAIL_HASH_SECRET ?? 'development-only-email-hash-secret-not-for-production',
  COOKIE_SECURE: data.COOKIE_SECURE ?? data.NODE_ENV === 'production',
  clientOrigins: data.CLIENT_ORIGIN.split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean),
  // S7: everyone who should be an admin: ADMIN_EMAIL first, then ADMIN_EMAILS.
  adminEmails: [...new Set([data.ADMIN_EMAIL.trim().toLowerCase(), ...data.ADMIN_EMAILS])],
})
