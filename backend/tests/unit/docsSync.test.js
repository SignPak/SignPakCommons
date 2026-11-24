import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import url from 'node:url'
import { listRoutes, routeKey } from '../support/routeInventory.js'

/**
 * Phase 10 (FIX-PLAN item 1): the docs keep up with the code. Every API route must be in the
 * OpenAPI spec, and every environment variable env.js reads must be in both .env examples and in
 * the env tables of docs/setup.md, so a later change can't add one without documenting it.
 */

const backendRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..')
// Normalised: a Windows checkout (core.autocrlf) gives CRLF line endings.
const read = (relative) => fs.readFileSync(path.join(backendRoot, relative), 'utf8').replace(/\r\n/g, '\n')

// app.js validates the environment on import; nothing connects to a database here.
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://placeholder/unused'
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'
process.env.ADMIN_EMAIL = 'admin@signpak.test'
process.env.ADMIN_PASSWORD = 'Admin@12345'

// Routes that are not part of the API, so they are not in the spec: the API root greeting, the
// favicon, and the spec itself (/docs.json, and /api-docs.json, its older alias).
const NOT_IN_SPEC = new Set(['GET /', 'GET /favicon.ico', 'GET /docs.json', 'GET /api-docs.json'])

/** The keys of the Zod schema in src/config/env.js (the `const schema = z.object({ ... })` block). */
function envKeys() {
  const source = read('src/config/env.js')
  const block = /const schema = z\.object\(\{\n([\s\S]*?)\n\}\)/.exec(source)
  assert.ok(block, 'could not find the env schema in src/config/env.js')
  return [...block[1].matchAll(/^ {2}([A-Z][A-Z0-9_]*):/gm)].map(([, key]) => key)
}

/** Names set (or shown commented out) in an .env example: `NAME=` or `# NAME=`. */
const exampleKeys = (relative) => new Set([...read(relative).matchAll(/^#? ?([A-Z][A-Z0-9_]*)=/gm)].map(([, key]) => key))

/** Names in the env tables of setup.md: rows that start with | `NAME` |. */
const setupKeys = () => new Set([...read('docs/setup.md').matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map(([, key]) => key))

test('Docs: every API route is in the OpenAPI spec', async () => {
  const [{ default: app }, { openapi }] = await Promise.all([import('../../src/app.js'), import('../../src/docs/openapi.js')])
  const documented = new Set()
  for (const [specPath, operations] of Object.entries(openapi.paths)) {
    for (const method of Object.keys(operations)) {
      if (method === 'parameters') continue
      documented.add(`${method.toUpperCase()} /api/v1${specPath.replace(/\{(\w+)\}/g, ':$1')}`)
    }
  }
  const registered = listRoutes(app).map(routeKey).filter((key) => !NOT_IN_SPEC.has(key))
  assert.ok(registered.length >= 50, `expected the full router, found ${registered.length} routes`)
  const undocumented = registered.filter((key) => !documented.has(key) && !documented.has(key.replace(' /api/v1', ' ')))
  assert.deepEqual(undocumented, [], 'routes missing from src/docs/openapi.js')
})

test('Docs: every environment variable is in .env.example, .env.production.example and setup.md', () => {
  const keys = envKeys()
  assert.ok(keys.length >= 40, `expected the full env schema, found ${keys.length} keys`)
  const development = exampleKeys('.env.example')
  const production = exampleKeys('.env.production.example')
  const setup = setupKeys()
  // Test-only: env.js refuses it in production, so the production example leaves it out on purpose.
  const notForProduction = new Set(['E2E_TEST_HOOKS'])
  const problems = []
  for (const key of keys) {
    if (!development.has(key)) problems.push(`${key} is not in .env.example`)
    if (!production.has(key) && !notForProduction.has(key)) problems.push(`${key} is not in .env.production.example`)
    if (!setup.has(key)) problems.push(`${key} is not in the env tables of docs/setup.md`)
  }
  assert.deepEqual(problems, [])
})
