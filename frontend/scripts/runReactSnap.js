/**
 * Prerenders the app's static routes to plain HTML using react-snap, so a search engine
 * (or anyone with JavaScript disabled) gets real markup on first load instead of an empty
 * <div id="root">. Run `npm run build` first — react-snap crawls the built `dist/` folder
 * with headless Chromium and writes the rendered HTML back into it, one file per route.
 *
 * The routes it visits come from react-snap-routes.json (see scripts/generateSeoAssets.js),
 * not from a hand-maintained list, so both scripts always agree on which pages are public.
 *
 * react-snap's own CLI reads its options from a "reactSnap" key in package.json, but that
 * only happens in its bin/run.js wrapper; the `run()` function this script calls directly
 * takes an options object as its first argument and does not read package.json itself, so
 * the route list and the dist/ output folder (Vite, not react-snap's CRA-era "build"
 * default) are passed straight through instead.
 *
 * ESM, matching this project's "type": "module" (react-snap's own API is CommonJS, so it is
 * loaded with createRequire rather than a static import).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const routesPath = path.join(projectRoot, 'react-snap-routes.json')
const distDir = path.join(projectRoot, 'dist')
const require = createRequire(import.meta.url)

function loadRoutes() {
  if (!fs.existsSync(routesPath)) {
    console.error(`${routesPath} does not exist yet. Run "npm run seo:generate" first.`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(routesPath, 'utf8'))
}

async function main() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('dist/index.html not found. Run "npm run build" before "npm run snap".')
    process.exit(1)
  }
  const routes = loadRoutes()
  console.log(`Prerendering ${routes.length} route(s) with react-snap: ${routes.join(', ')}`)

  let reactSnap
  try {
    reactSnap = require('react-snap')
  } catch {
    console.error('react-snap is not installed. Run "npm install" (it is a devDependency) and try again.')
    process.exit(1)
  }

  await reactSnap.run({
    source: 'dist',
    include: routes,
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    // Chromium refuses its normal sandbox when the whole process tree is already running as
    // root (common in CI containers and this project's own build sandbox); --no-sandbox
    // trades that OS-level sandbox for the container's own isolation, which is the standard,
    // documented workaround for headless Chromium under root.
    puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  console.log('Prerendering complete. dist/ now has static HTML for each route above.')
}

main().catch((error) => {
  console.error('Failed to prerender with react-snap:', error)
  process.exit(1)
})
