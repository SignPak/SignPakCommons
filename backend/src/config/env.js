import 'dotenv/config'
import { z } from 'zod'

const bool = z.union([z.boolean(), z.enum(['true', 'false']).transform((value) => value === 'true')])

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: bool.default(false),

  MONGODB_URI: z.string({ error: 'MONGODB_URI is required (for example mongodb://127.0.0.1:27017/signpakcommons)' }).min(1, 'MONGODB_URI is required'),

  // Comma-separated list of browser origins allowed to call the API with cookies.
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string({ error: 'JWT_SECRET is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"' }).min(32, 'JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'),
  JWT_EXPIRES_DAYS: z.coerce.number().positive().default(7),
  COOKIE_SECURE: bool.optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  ADMIN_EMAIL: z.email({ error: 'ADMIN_EMAIL is required and must be a valid email' }),
  ADMIN_PASSWORD: z.string({ error: 'ADMIN_PASSWORD is required (at least 8 characters)' }).min(8, 'ADMIN_PASSWORD must be at least 8 characters').max(72),
  ADMIN_FIRST_NAME: z.string().min(1).default('Admin'),
  ADMIN_SURNAME: z.string().min(1).default('Signpak'),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().positive().default(300),
  MAX_RECORDING_UPLOAD_MB: z.coerce.number().positive().default(100),

  RATE_LIMIT_ENABLED: bool.default(true),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
  console.error(`\nInvalid environment configuration:\n${lines.join('\n')}\n\nCopy .env.example to .env and fill in the values.\n`)
  process.exit(1)
}

const data = parsed.data
export const env = Object.freeze({
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  // Secure cookies by default in production; override for local HTTPS-less setups.
  COOKIE_SECURE: data.COOKIE_SECURE ?? data.NODE_ENV === 'production',
  clientOrigins: data.CLIENT_ORIGIN.split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean),
})
