/**
 * Fails when the main (entry) chunk of the production build is over 300 kB (FIX-PLAN Phase 9,
 * item 4). Run after `npm run build`: `npm run check:bundle`. CI runs it in the Frontend job.
 *
 * The entry chunk is the module script dist/index.html loads: the code every visitor downloads
 * before the first page renders. Lazy pages (React.lazy) are separate chunks and don't count.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 300 kB as Vite prints sizes (kB = 1000 bytes).
export const MAX_ENTRY_BYTES = 300_000

/** The entry chunk's path relative to dist/, from the built index.html. */
export function entryScriptPath(html) {
  const match = /<script\b[^>]*\btype="module"[^>]*\bsrc="\/?([^"]+)"/.exec(html)
  if (!match) throw new Error('No entry <script type="module"> found in index.html.')
  return match[1]
}

export function checkBundle({ distDir, limit = MAX_ENTRY_BYTES }) {
  const file = entryScriptPath(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8'))
  const bytes = fs.statSync(path.join(distDir, file)).size
  return { ok: bytes <= limit, bytes, limit, file }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  const { ok, bytes, limit, file } = checkBundle({ distDir })
  const kb = (value) => `${(value / 1000).toFixed(2)} kB`
  if (ok) {
    console.log(`Main chunk ${file}: ${kb(bytes)} (limit ${kb(limit)}).`)
  } else {
    console.error(`Main chunk ${file} is ${kb(bytes)}, over the ${kb(limit)} limit. Load more of the app lazily (src/App.jsx).`)
    process.exitCode = 1
  }
}
