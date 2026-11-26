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
    'server_name api.commons.signpak.tech;',
    'return 301 https://$host$request_uri;',
  ]) {
    assert.ok(has(directive), `deploy/nginx/api.conf is missing: ${directive}`)
  }
  assert.ok(!directives.some((line) => line.startsWith('proxy_cache ')), 'API responses must never be cached by Nginx')
  assert.ok(nginx.includes('/etc/letsencrypt/live/api.commons.signpak.tech/fullchain.pem'))
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

test('C1: deploy files name api.commons.signpak.tech and commons.signpak.tech, with no placeholders left', () => {
  // D2: the site is commons.signpak.tech and the API api.commons.signpak.tech. The API is
  // deliberately not api.signpak.tech, which is kept for the future SignPAK app backend.
  const files = ['deploy/nginx/api.conf', 'deploy/README.md', 'deploy/deploy.sh', 'backend/.env.production.example']
  for (const file of files) {
    const text = read(file)
    assert.ok(!text.includes('<DOMAIN>'), `${file} still has a <DOMAIN> placeholder`)
    // Used as an address (URL, server_name, certificate path, env value); a sentence explaining
    // why it is not used is fine.
    assert.ok(!/(https?:\/\/|server_name\s+|live\/|=)api\.signpak\.tech/.test(text), `${file} uses api.signpak.tech, which is reserved for the SignPAK app`)
    assert.ok(!/railway\.app|signpakcommons\.example/i.test(text), `${file} names an old host`)
  }
  assert.ok(read('deploy/nginx/api.conf').includes('server_name api.commons.signpak.tech;'))
  assert.ok(read('deploy/README.md').includes('https://api.commons.signpak.tech'))
  assert.ok(read('deploy/README.md').includes('https://commons.signpak.tech'))
})

test('C1: the production env template is a valid production configuration once filled in', () => {
  const template = read('backend/.env.production.example')
  const values = Object.fromEntries(template.split('\n')
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]))

  assert.equal(values.NODE_ENV, 'production')
  assert.equal(values.TRUST_PROXY, 'true')
  assert.equal(values.HOST, '127.0.0.1') // S3: only Nginx can reach Node
  assert.equal(values.CLIENT_ORIGIN, 'https://commons.signpak.tech')
  assert.equal(values.BREVO_SENDER_EMAIL, 'no-reply@signpak.tech')
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
    WEB3FORMS_ACCESS_KEY: 'key',
    EMAIL_HASH_SECRET: 'production-email-hash-secret-production-email-hash',
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
    console.log(JSON.stringify({ production: env.isProduction, secure: env.COOKIE_SECURE, host: env.HOST, origins: env.clientOrigins, warnings: startupWarnings(env) }))
  `], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...filled },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.deepEqual(JSON.parse(output.trim()), {
    production: true,
    secure: true,
    host: '127.0.0.1',
    origins: ['https://commons.signpak.tech'],
    warnings: [],
  })
})

// Phase 11 (D1): the API runs on the team's Hostinger KVM-8 as a Coolify application built from
// backend/Dockerfile, behind Coolify's Traefik. deploy/scripts/check-docker-image.sh checks the
// built image in CI; these tests pin down the files themselves.

const dockerfile = read('backend/Dockerfile')
const dockerLines = dockerfile.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
// Continuation lines joined, so a multi-line instruction can be matched as one.
const instructions = dockerfile.replace(/\\\n\s*/g, ' ').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
const envExampleValue = (key) => new RegExp(`^${key}=(.*)$`, 'm').exec(read('backend/.env.production.example'))?.[1]

test('D1: the Dockerfile builds a slim production image of Node 22 that runs as the node user', () => {
  const froms = instructions.filter((line) => line.startsWith('FROM '))
  assert.ok(froms.length >= 1)
  const nvmrcMajor = read('.nvmrc').trim().replace(/^v/, '').split('.')[0]
  for (const from of froms) {
    assert.match(from, /^FROM node:(\d+)-bookworm-slim( AS \w+)?$/, from)
    assert.equal(/node:(\d+)/.exec(from)[1], nvmrcMajor, 'the image must use the Node major in .nvmrc')
  }
  assert.ok(instructions.some((line) => /^RUN npm ci --omit=dev\b/.test(line)), 'dependencies must be installed with npm ci --omit=dev')
  assert.ok(!/npm (i|install)\b/.test(dockerfile), 'npm ci only: the lockfile decides the versions')
  assert.ok(instructions.some((line) => /^ENV .*\bNODE_ENV=production\b/.test(line)))
  assert.equal(instructions.filter((line) => line.startsWith('USER ')).at(-1), 'USER node')
  assert.ok(dockerLines.includes(`EXPOSE ${envExampleValue('PORT')}`), 'EXPOSE must match PORT in .env.production.example')
  // Exec form, so Node is PID 1 and receives SIGTERM itself (graceful shutdown).
  assert.equal(instructions.filter((line) => line.startsWith('CMD ')).at(-1), 'CMD ["node", "server.js"]')
  const healthcheck = instructions.find((line) => line.startsWith('HEALTHCHECK '))
  assert.ok(healthcheck, 'the image needs a HEALTHCHECK (Coolify uses it for rolling updates)')
  assert.match(healthcheck, /\/api\/v1\/health/)
  assert.match(healthcheck, /CMD \["node", /, 'the slim image has no curl or wget: the check runs with node')
})

/** True when the build context sends `file` (Docker's .dockerignore rules: the last match wins). */
function sentToDocker(rules, file) {
  const toRegex = (pattern) => new RegExp(`^${pattern.replace(/\/$/, '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')}$`)
  const segments = file.split('/')
  const prefixes = segments.map((_, index) => segments.slice(0, index + 1).join('/'))
  let included = true
  for (const rule of rules) {
    const negated = rule.startsWith('!')
    const regex = toRegex(negated ? rule.slice(1) : rule)
    if (prefixes.some((prefix) => regex.test(prefix))) included = negated
  }
  return included
}

test('D1: .dockerignore sends only the app: no tests, .env files, node_modules, coverage, uploads or scripts', () => {
  const rules = read('backend/.dockerignore').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  for (const file of ['server.js', 'package.json', 'package-lock.json', 'src/app.js', 'src/config/env.js']) {
    assert.ok(sentToDocker(rules, file), `${file} must be in the build context`)
  }
  for (const file of [
    'node_modules/express/index.js',
    'tests/unit/deployConfig.test.js',
    'coverage/lcov.info',
    '.env',
    '.env.example',
    '.env.production.example',
    'src/.env',
    'uploads/tmp/recording.webm',
    'scripts/e2e-server.js',
    'docs/setup.md',
    '.c8rc.json',
  ]) {
    assert.ok(!sentToDocker(rules, file), `${file} must stay out of the image`)
  }
})

test('D1: the Coolify guide comes first and names the settings the API depends on', () => {
  const guide = read('deploy/README.md')
  const coolify = guide.indexOf('Coolify')
  const pm2 = guide.indexOf('PM2')
  assert.ok(coolify >= 0 && coolify < pm2, 'Coolify is the main path; Nginx + PM2 is the alternative')
  for (const text of [
    'Base Directory',
    '`/backend`',
    'Dockerfile',
    'https://api.commons.signpak.tech',
    'Ports Mappings',
    'HOST=0.0.0.0',
    'TRUST_PROXY=true',
    '/api/v1/health',
    'Manual deployments only',
    'COOLIFY_WEBHOOK',
    'COOLIFY_TOKEN',
    'Stop Grace Period',
    '--entrypoints.http.transport.respondingTimeouts.readTimeout=',
    '--entrypoints.https.transport.respondingTimeouts.readTimeout=',
  ]) {
    assert.ok(guide.includes(text), `deploy/README.md is missing: ${text}`)
  }
  // Traefik must let a request take at least as long as the API does (REQUEST_TIMEOUT_MS).
  const requestTimeoutMs = Number(envExampleValue('REQUEST_TIMEOUT_MS'))
  assert.ok(requestTimeoutMs >= 60_000)
  for (const entrypoint of ['http', 'https']) {
    const seconds = Number(new RegExp(`--entrypoints\\.${entrypoint}\\.transport\\.respondingTimeouts\\.readTimeout=(\\d+)s`).exec(guide)?.[1])
    assert.ok(seconds * 1000 >= requestTimeoutMs, `Traefik's ${entrypoint} readTimeout (${seconds}s) must be at least REQUEST_TIMEOUT_MS (${requestTimeoutMs} ms)`)
  }
})

test('D1: CI builds and checks the image, and deploys only from main, after every other job, through a POST webhook', () => {
  const ci = read('.github/workflows/ci.yml')
  const jobsText = ci.slice(ci.indexOf('\njobs:\n'))
  const jobIds = [...jobsText.matchAll(/^ {2}([a-z0-9-]+):$/gm)].map(([, id]) => id)
  const block = (id) => {
    const start = jobsText.indexOf(`\n  ${id}:\n`)
    assert.ok(start >= 0, `ci.yml has no ${id} job`)
    const next = jobsText.slice(start + 1).search(/\n {2}[a-z0-9-]+:\n/)
    return next < 0 ? jobsText.slice(start) : jobsText.slice(start, start + 1 + next)
  }

  const image = block('docker-image')
  assert.match(image, /image: mongo:7/)
  assert.match(image, /docker build .*backend/)
  assert.match(image, /deploy\/scripts\/check-docker-image\.sh/)

  const deploy = block('deploy-coolify')
  assert.match(deploy, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/)
  const needs = /needs: \[([^\]]+)\]/.exec(deploy)[1].split(',').map((id) => id.trim())
  assert.deepEqual([...needs].sort(), jobIds.filter((id) => id !== 'deploy-coolify').sort(), 'the deploy waits for every other job')
  assert.match(deploy, /COOLIFY_TOKEN: \$\{\{ secrets\.COOLIFY_TOKEN \}\}/)
  assert.match(deploy, /COOLIFY_WEBHOOK: \$\{\{ secrets\.COOLIFY_WEBHOOK \}\}/)
  assert.match(deploy, /::notice title=Deploy skipped::/)
  // Coolify v4 answers GET /api/v1/deploy with 405: only POST deploys.
  assert.match(deploy, /curl --fail [^\n]*-X POST [^\n]*-H "Authorization: Bearer \$COOLIFY_TOKEN" "\$COOLIFY_WEBHOOK"/)
  // The deploy-files job shellchecks the image check script too.
  assert.match(block('deploy'), /shellcheck [^\n]*deploy\/scripts\/check-docker-image\.sh/)
})

test('D1: the image health check uses /health/live, so a storage failure never takes the API offline', () => {
  // Traefik stops routing to an unhealthy container. /health fails on storage too (a Drive
  // token, D3), which would take login and browsing down with the uploads.
  const healthcheck = instructions.find((line) => line.startsWith('HEALTHCHECK '))
  assert.match(healthcheck, /\/api\/v1\/health\/live'/)
  assert.ok(!/\/api\/v1\/health'/.test(healthcheck), 'not /api/v1/health, which also fails on storage')
  // A bare server's deploy.sh keeps checking the full /health.
  assert.match(read('deploy/deploy.sh'), /\/api\/v1\/health\b(?!\/live)/)
  const guide = read('deploy/README.md')
  for (const text of ['/api/v1/health/live', '"storage":true', 'uploads fail', 'the site stays up']) {
    assert.ok(guide.includes(text), `deploy/README.md is missing: ${text}`)
  }
})
