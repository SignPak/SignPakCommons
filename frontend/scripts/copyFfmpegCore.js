/**
 * S8: serves the ffmpeg.wasm core from the site itself (public/ffmpeg/), so the admin video tool
 * never loads code from a CDN and the CSP needs no third-party script host.
 *
 * The files come from the @ffmpeg/core package, pinned to an exact version in package.json, so
 * npm has checked them against the lockfile's integrity hash. Runs before `vite build` and
 * `vite` (prebuild/predev); public/ffmpeg/ is generated and gitignored.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')
const target = path.join(projectRoot, 'public', 'ffmpeg')
export const FFMPEG_CORE_FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm']

fs.mkdirSync(target, { recursive: true })
for (const file of FFMPEG_CORE_FILES) {
  const from = path.join(source, file)
  if (!fs.existsSync(from)) {
    console.error(`Missing ${path.relative(projectRoot, from)}. Run npm install in frontend.`)
    process.exit(1)
  }
  fs.copyFileSync(from, path.join(target, file))
}
const { version } = JSON.parse(fs.readFileSync(path.join(source, '..', '..', 'package.json'), 'utf8'))
console.log(`Copied @ffmpeg/core ${version} to public/ffmpeg/.`)
