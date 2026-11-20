import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import url from 'node:url'

/**
 * C1: the files the team uses to run the API on its own server (deploy/). `nginx -t` itself runs
 * in CI (deploy/scripts/check-nginx.sh); these tests pin down the settings that matter for
 * uploads, client IPs and rate limits, so a later edit cannot quietly drop one.
 */

const backendRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..')
const repoRoot = path.resolve(backendRoot, '..')
// Normalised: a Windows checkout (core.autocrlf) gives CRLF line endings.
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8').replace(/\r\n/g, '\n')
const nginx = read('deploy/nginx/api.conf')
const directives = nginx.split('\n').map((line) => line.replace(/#.*/, '').trim()).filter(Boolean)
const has = (directive) => directives.includes(directive)

test('C1: nginx config sets the body limit, unbuffered uploads, timeouts and forwarding headers', () => {
  for (const directive of [
    'client_max_body_size 110m;',
    'proxy_request_buffering off;',
    'proxy_read_timeout 300s;',
    'proxy_send_timeout 300s;',
    'proxy_pass http://127.0.0.1:5000;',
    'proxy_set_header Host              $host;',
    'proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;',
    'proxy_set_header X-Forwarded-Proto $scheme;',
    'proxy_no_cache 1;',
    'server_name api.<DOMAIN>;',
    'return 301 https://$host$request_uri;',
  ]) {
    assert.ok(has(directive), `deploy/nginx/api.conf is missing: ${directive}`)
  }
  assert.ok(!directives.some((line) => line.startsWith('proxy_cache ')), 'API responses must never be cached by Nginx')
  assert.ok(nginx.includes('/etc/letsencrypt/live/api.<DOMAIN>/fullchain.pem'))
})

test('C1: nginx body limit leaves room above the API upload limit', () => {
  const nginxMb = Number(/client_max_body_size (\d+)m;/.exec(nginx)[1])
  const apiMb = Number(/^MAX_RECORDING_UPLOAD_MB=(\d+)$/m.exec(read('backend/.env.production.example'))[1])
  assert.ok(nginxMb > apiMb, `Nginx (${nginxMb} MB) must accept more than the API limit (${apiMb} MB) so the API can answer 413 itself`)
})

test('C1: PM2 runs exactly one fork-mode process', () => {
  const require = createRequire(import.meta.url)
  const { apps } = require(path.join(repoRoot, 'deploy', 'ecosystem.config.cjs'))
  assert.equal(apps.length, 1)
  const [api] = apps
  // In-memory rate limits only work with a single process (FIX-PLAN D1).
  assert.equal(api.instances, 1)
  assert.equal(api.exec_mode, 'fork')
  assert.equal(api.script, 'server.js')
  assert.equal(path.resolve(api.cwd), path.join(repoRoot, 'backend'))
  assert.equal(api.autorestart, true)
  assert.ok(api.max_memory_restart)
  // PM2 must wait longer than the graceful-shutdown drain (10 s) before SIGKILL.
  assert.ok(api.kill_timeout > 10_000)
  assert.match(api.out_file, /^\/var\/log\/signpakcommons\//)
  assert.equal(api.env.NODE_ENV, 'production')
})

test('C1: deploy.sh stops on errors and fails unless health reports ok', () => {
  const script = read('deploy/deploy.sh')
  assert.match(script, /^set -euo pipefail$/m)
  assert.match(script, /npm ci --omit=dev/)
  assert.match(script, /pm2 reload deploy\/ecosystem\.config\.cjs/)
  assert.match(script, /\/api\/v1\/health/)
  assert.match(script, /"status":"ok"/)
  assert.match(script, /exit 1\s*$/)
})

test('C1: deploy files use the <DOMAIN> placeholder, never a real host', () => {
  const files = ['deploy/nginx/api.conf', 'deploy/README.md', 'backend/.env.production.example']
  for (const file of files) {
    const text = read(file)
    assert.ok(text.includes('<DOMAIN>'), `${file} should use the <DOMAIN> placeholder`)
    assert.ok(!/railway\.app|vercel\.app|signpakcommons\.example/i.test(text), `${file} names an old host`)
  }
})

test('C1: the production env template is a valid production configuration once filled in', () => {
  const template = read('backend/.env.production.example')
  const values = Object.fromEntries(template.split('\n')
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replaceAll('<DOMAIN>', 'example.test')]))

  assert.equal(values.NODE_ENV, 'production')
  assert.equal(values.TRUST_PROXY, 'true')
  assert.equal(values.CLIENT_ORIGIN, 'https://commons.example.test')
  assert.equal(values.COOKIE_SAMESITE, 'lax')
  assert.equal(values.COOKIE_SECURE, 'true')
  assert.equal(values.STORAGE_DRIVER, 'gdrive')
  assert.equal(values.ARCHIVE_STORAGE_DRIVER, 'gdrive')
  assert.equal(values.AUTH_OTP_TTL_MINUTES, '10')

  // The secrets the template leaves empty, filled with stand-ins.
  const filled = {
    ...values,
    MONGODB_URI: 'mongodb://127.0.0.1/signpak',
    JWT_SECRET: 'a'.repeat(48),
    BREVO_API_KEY: 'key',
    BREVO_SENDER_EMAIL: 'auth@example.test',
    WEB3FORMS_ACCESS_KEY: 'key',
    ADMIN_EMAIL: 'admin@example.test',
    ADMIN_PASSWORD: 'Admin@12345',
    GOOGLE_OAUTH_CLIENT_ID: 'id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
    GOOGLE_OAUTH_REFRESH_TOKEN: 'token',
    GOOGLE_DRIVE_FOLDER_ID: 'folder',
  }
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    const { env } = await import('./src/config/env.js')
    const { startupWarnings } = await import('./src/config/startupChecks.js')
    console.log(JSON.stringify({ production: env.isProduction, secure: env.COOKIE_SECURE, warnings: startupWarnings(env) }))
  `], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...filled },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.deepEqual(JSON.parse(output.trim()), { production: true, secure: true, warnings: [] })
})
