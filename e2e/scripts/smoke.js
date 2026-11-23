#!/usr/bin/env node
/**
 * npm run e2e:smoke -- --base-url=https://commons.signpak.tech [other Playwright options]
 *
 * Runs the @smoke subset (tests/smoke.spec.js) against the given site. For anything but a local
 * URL it needs SMOKE_EMAIL and SMOKE_PASSWORD, from the environment or from e2e/.env.smoke
 * (gitignored; KEY=value lines), and refuses to start without them, so it never sends a guessed
 * password that would count toward the account lockout.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const e2eRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')

/** KEY=value lines from e2e/.env.smoke; values already in the environment win. */
function loadSmokeEnv() {
  const file = path.join(e2eRoot, '.env.smoke')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match || line.trimStart().startsWith('#')) continue
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

export function parseArgs(argv) {
  const rest = []
  let baseUrl = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg.startsWith('--base-url=')) baseUrl = arg.slice('--base-url='.length)
    else if (arg === '--base-url') baseUrl = argv[++index] ?? null
    else rest.push(arg)
  }
  return { baseUrl, rest }
}

export const isLocal = (baseUrl) => ['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)

function main() {
  loadSmokeEnv()
  const { baseUrl, rest } = parseArgs(process.argv.slice(2))
  if (!baseUrl) {
    console.error('Usage: npm run e2e:smoke -- --base-url=<site URL> [Playwright options]')
    process.exit(2)
  }
  try { new URL(baseUrl) } catch {
    console.error(`Not a URL: ${baseUrl}`)
    process.exit(2)
  }
  if (!isLocal(baseUrl) && !(process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD)) {
    console.error('SMOKE_EMAIL and SMOKE_PASSWORD are required for a non-local site. Set them in the environment or in e2e/.env.smoke (gitignored).')
    process.exit(2)
  }
  const cli = path.join(e2eRoot, 'node_modules', '@playwright', 'test', 'cli.js')
  const result = spawnSync(process.execPath, [cli, 'test', '--config', 'playwright.smoke.config.js', ...rest], {
    cwd: e2eRoot,
    stdio: 'inherit',
    env: { ...process.env, SMOKE_BASE_URL: baseUrl.replace(/\/$/, '') },
  })
  process.exit(result.status ?? 1)
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) main()
