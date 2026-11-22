#!/usr/bin/env node
/**
 * B5: turns the admin export (GET /admin/submissions/export?format=json) into a dataset of
 * trimmed, mirrored clips the ML team can train on:
 *
 *   <out>/<category>/<video>/<submissionId>.mp4
 *
 * Each recording is downloaded by its Drive file id (or read from a local folder), then ffmpeg
 * cuts it to [trimStart, trimEnd], flips it if the contributor recorded mirrored, drops the audio
 * and writes H.264 MP4. Runs on a team machine, never on the server. See docs/DATASET.md.
 *
 *   node scripts/prepare-dataset.js --input export.json --out ./dataset [--local-root <dir>]
 *                                    [--concurrency 2] [--overwrite]
 *
 * Only the Google variables are needed (from the environment or ./.env), not the server's
 * full configuration: GOOGLE_ARCHIVE_OAUTH_CLIENT_ID/_CLIENT_SECRET/_REFRESH_TOKEN (falling back
 * to GOOGLE_OAUTH_*), or GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON.
 * ffmpeg comes with `npm install` (the ffmpeg-static devDependency); see findFfmpeg for the
 * order it is looked for in. FFMPEG_PATH is only an override.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pipeline } from 'node:stream/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { safeName } from '../src/utils/files.js'

// Millisecond precision, without floating-point noise (0.3 - 0.1 is 0.19999999999999998).
const seconds = (value) => String(Number(Number(value).toFixed(3)))

/** The ffmpeg arguments for one clip. Pure, so it is tested without ffmpeg. */
export function buildFfmpegArgs({ input, output, trimStart, trimEnd, mirrored }) {
  const start = Number(trimStart)
  const length = Number(trimEnd) - start
  if (!Number.isFinite(start) || !Number.isFinite(length) || start < 0 || length <= 0) {
    throw new Error(`Invalid trim: ${trimStart} to ${trimEnd}`)
  }
  return [
    '-hide_banner', '-loglevel', 'error',
    // Seeking before -i is fast; -t is computed, so a WebM without duration metadata still works.
    '-ss', seconds(start), '-i', input, '-t', seconds(length),
    ...(mirrored ? ['-vf', 'hflip'] : []),
    // No audio: sign data needs none, and it keeps voices out of the dataset.
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-y', output,
  ]
}

// A folder name that is safe on every OS and can never be "." or "..".
const folderName = (value, fallback) => {
  const name = safeName(value, fallback)
  return /^\.+$/.test(name) ? fallback : name
}

/** Where one row's clip goes: <outDir>/<category>/<video>/<submissionId>.mp4. */
export function outputPathFor(outDir, row) {
  return path.join(outDir, folderName(row.categoryLabel, 'Unassigned'), folderName(row.videoTitle, 'Untitled'), `${folderName(row.submissionId, 'submission')}.mp4`)
}

// ffmpeg-static is a devDependency: present after `npm install` in backend, absent on the
// server (npm ci --omit=dev). It exports the binary's path, or null on an unsupported platform.
const loadFfmpegStatic = () => {
  try { return createRequire(import.meta.url)('ffmpeg-static') } catch { return null }
}

/**
 * Which ffmpeg to run, in this order: FFMPEG_PATH (an override); then the ffmpeg-static binary,
 * if it is installed and its download is on disk; then `ffmpeg` on PATH.
 */
export function findFfmpeg({ env = process.env, loadStatic = loadFfmpegStatic, fileExists = fs.existsSync } = {}) {
  if (env.FFMPEG_PATH) return { path: env.FFMPEG_PATH, source: 'FFMPEG_PATH' }
  const bundled = loadStatic()
  if (typeof bundled === 'string' && bundled && fileExists(bundled)) return { path: bundled, source: 'ffmpeg-static' }
  return { path: 'ffmpeg', source: 'PATH' }
}

/** The message for an ffmpeg that could not be started. */
export function ffmpegNotFoundMessage({ path: binary, source }) {
  return source === 'FFMPEG_PATH'
    ? `ffmpeg was not found at FFMPEG_PATH (${binary}). Fix or unset FFMPEG_PATH.`
    : 'ffmpeg was not found. Run `npm install` in backend (it brings ffmpeg-static), or set FFMPEG_PATH to an ffmpeg binary.'
}

/**
 * Processes every row: skip a clip that already exists (unless overwrite), else download to a
 * temp file, run ffmpeg, and remove the temp file. A failed row is reported and the run goes
 * on. Every side effect is passed in, so the loop is tested with fakes.
 */
export async function runDataset(rows, { outDir, tempDir, exists, fetchFile, runFfmpeg, removeFile, overwrite = false, concurrency = 1, log = () => {} }) {
  const summary = { done: 0, skipped: 0, failed: [] }
  const queue = [...rows]
  async function worker() {
    while (queue.length) {
      const row = queue.shift()
      const output = outputPathFor(outDir, row)
      if (!overwrite && await exists(output)) {
        summary.skipped += 1
        continue
      }
      const tempPath = path.join(tempDir, `${folderName(row.submissionId, 'submission')}.source`)
      try {
        await fetchFile(row, tempPath)
        await runFfmpeg(buildFfmpegArgs({ input: tempPath, output, trimStart: row.trimStart, trimEnd: row.trimEnd, mirrored: row.mirrored }), output)
        summary.done += 1
        log(`done ${row.submissionId}`)
      } catch (error) {
        summary.failed.push({ submissionId: row.submissionId, reason: error.message })
        log(`FAILED ${row.submissionId}: ${error.message}`)
      } finally {
        await removeFile(tempPath)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return summary
}

/** Reads the recording files: Drive by file id, or a local folder for local-driver exports. */
async function createFetcher({ localRoot }) {
  let drive = null
  const driveClient = async () => {
    if (drive) return drive
    const { google } = await import('googleapis')
    const env = process.env
    const oauth = [env.GOOGLE_ARCHIVE_OAUTH_CLIENT_ID, env.GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET, env.GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN].every(Boolean)
      ? [env.GOOGLE_ARCHIVE_OAUTH_CLIENT_ID, env.GOOGLE_ARCHIVE_OAUTH_CLIENT_SECRET, env.GOOGLE_ARCHIVE_OAUTH_REFRESH_TOKEN]
      : [env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET, env.GOOGLE_OAUTH_REFRESH_TOKEN]
    let auth
    if (oauth.every(Boolean)) {
      auth = new google.auth.OAuth2(oauth[0], oauth[1])
      auth.setCredentials({ refresh_token: oauth[2] })
    } else {
      const raw = env.GOOGLE_ARCHIVE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON
      if (!raw) throw new Error('No Google credentials: set the GOOGLE_ARCHIVE_OAUTH_* (or GOOGLE_OAUTH_*) variables or a service-account JSON.')
      const { parseServiceAccountCredentials } = await import('../src/utils/parseCredentials.js')
      auth = new google.auth.GoogleAuth({ credentials: parseServiceAccountCredentials(raw), scopes: ['https://www.googleapis.com/auth/drive.readonly'] })
    }
    drive = google.drive({ version: 'v3', auth })
    return drive
  }

  return async function fetchFile(row, tempPath) {
    if (row.storageDriver === 'local') {
      if (!localRoot) throw new Error('This row is on local storage: pass --local-root <the API\'s UPLOAD_DIR>.')
      if (String(row.driveFileId).split(/[\\/]/).some((part) => part === '..')) throw new Error('Refusing a file key that leaves --local-root.')
      await fsp.copyFile(path.join(localRoot, row.driveFileId), tempPath)
      return
    }
    const client = await driveClient()
    const response = await client.files.get({ fileId: row.driveFileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' })
    await pipeline(response.data, fs.createWriteStream(tempPath))
  }
}

function runFfmpeg(ffmpeg, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg.path, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000) })
    child.on('error', (error) => reject(error.code === 'ENOENT' ? new Error(ffmpegNotFoundMessage(ffmpeg)) : error))
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`))))
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' }, out: { type: 'string' }, 'local-root': { type: 'string' },
      concurrency: { type: 'string', default: '2' }, overwrite: { type: 'boolean', default: false },
    },
  })
  if (!values.input || !values.out) {
    console.error('Usage: node scripts/prepare-dataset.js --input export.json --out ./dataset [--local-root <dir>] [--concurrency 2] [--overwrite]')
    process.exit(2)
  }
  try { (await import('dotenv')).config() } catch { /* the variables may already be set */ }

  const rows = JSON.parse(await fsp.readFile(values.input, 'utf8'))
  if (!Array.isArray(rows)) throw new Error('The input must be the JSON export: an array of rows.')
  const ffmpeg = findFfmpeg()
  console.log(`Using ffmpeg from ${ffmpeg.source}: ${ffmpeg.path}`)
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'signpak-dataset-'))
  const outDir = path.resolve(values.out)
  try {
    const summary = await runDataset(rows, {
      outDir,
      tempDir,
      overwrite: values.overwrite,
      concurrency: Number(values.concurrency) || 1,
      exists: async (file) => fsp.access(file).then(() => true, () => false),
      fetchFile: await createFetcher({ localRoot: values['local-root'] && path.resolve(values['local-root']) }),
      runFfmpeg: async (args, output) => { await fsp.mkdir(path.dirname(output), { recursive: true }); await runFfmpeg(ffmpeg, args) },
      removeFile: (file) => fsp.rm(file, { force: true }),
      log: (line) => console.log(line),
    })
    console.log(`\n${summary.done} made, ${summary.skipped} already there, ${summary.failed.length} failed.`)
    for (const { submissionId, reason } of summary.failed) console.log(`  ${submissionId}: ${reason}`)
    process.exitCode = summary.failed.length ? 1 : 0
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
