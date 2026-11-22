import assert from 'node:assert/strict'
import { execFile, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { findFfmpeg } from '../../scripts/prepare-dataset.js'

/**
 * B5 (fixes after verification): the dataset script run for real, with a real ffmpeg, on a
 * recording made by ffmpeg itself: a 5 s 64x32 WebM, blue with a red box on the left half.
 * Checks the clips' folders, their lengths (the trim) and which side the red box is on (the
 * mirror).
 *
 * ffmpeg comes from the ffmpeg-static devDependency (or FFMPEG_PATH, or PATH: see findFfmpeg).
 * Locally the test is skipped only when no ffmpeg can be found at all; on CI (where npm ci runs
 * ffmpeg-static's install script) a missing ffmpeg fails it instead, so it can't go quiet.
 */

const run = promisify(execFile)
const SCRIPT = fileURLToPath(new URL('../../scripts/prepare-dataset.js', import.meta.url))
const WIDTH = 64
const HEIGHT = 32
const URDU_TITLE = 'سلام'

const ffmpeg = findFfmpeg()
const usable = spawnSync(ffmpeg.path, ['-hide_banner', '-version'], { stdio: 'ignore' }).status === 0
const missing = `no ffmpeg found (looked for ${ffmpeg.source}: ${ffmpeg.path}). Run npm install in backend, or set FFMPEG_PATH.`
if (!usable && process.env.CI) throw new Error(`CI must run this test: ${missing}`)
const skip = usable ? false : missing

const MIRRORED = '6740000000000000000000d1'
const PLAIN = '6740000000000000000000d2'
let root, outDir, result

const exportRow = (submissionId, fields) => ({
  submissionId, userId: '6740000000000000000000e1', videoId: '6740000000000000000000f1', videoTitle: 'Hello',
  categoryId: '6740000000000000000000c1', categoryLabel: 'Greetings', driveFileId: `recordings/${submissionId}.webm`,
  archivePath: null, mimeType: 'video/webm', size: 0, duration: 5, trimStart: 0, trimEnd: 5, mirrored: false,
  submittedAt: '2026-11-22T10:00:00.000Z', storageDriver: 'local', ...fields,
})

/** Length in seconds, as ffmpeg reports it ("Duration: 00:00:02.00"). */
async function durationOf(file) {
  // ffmpeg with an input and no output prints the input's details and exits with 1.
  const { stderr } = await run(ffmpeg.path, ['-hide_banner', '-i', file]).catch((error) => error)
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr)
  assert.ok(match, `no duration in: ${stderr}`)
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

/** The first frame as raw RGB, and a reader for one pixel. */
async function firstFrame(file) {
  const { stdout } = await run(ffmpeg.path, ['-v', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer', maxBuffer: 1 << 20 })
  assert.equal(stdout.length, WIDTH * HEIGHT * 3, 'one 64x32 RGB frame')
  return (x, y) => {
    const at = (y * WIDTH + x) * 3
    return { r: stdout[at], g: stdout[at + 1], b: stdout[at + 2] }
  }
}
const isRed = ({ r, g, b }) => r > 200 && g < 60 && b < 60
const isBlue = ({ r, g, b }) => b > 200 && r < 60 && g < 60

describe('B5: prepare-dataset with a real ffmpeg', { skip }, () => {
  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'signpak-dataset-test-'))
    const localRoot = path.join(root, 'uploads')
    outDir = path.join(root, 'dataset')
    await fs.mkdir(path.join(localRoot, 'recordings'), { recursive: true })

    // The recording: 5 s of blue with a red box filling the left half.
    const source = path.join(localRoot, 'recordings', `${MIRRORED}.webm`)
    await run(ffmpeg.path, [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=blue:s=${WIDTH}x${HEIGHT}:d=5:r=25`,
      '-vf', `drawbox=x=0:y=0:w=${WIDTH / 2}:h=${HEIGHT}:color=red:t=fill`, '-c:v', 'libvpx', '-b:v', '200k', '-pix_fmt', 'yuv420p', '-y', source,
    ])
    await fs.copyFile(source, path.join(localRoot, 'recordings', `${PLAIN}.webm`))

    const input = path.join(root, 'export.json')
    await fs.writeFile(input, JSON.stringify([
      exportRow(MIRRORED, { trimStart: 1, trimEnd: 3, mirrored: true }),
      exportRow(PLAIN, { trimStart: 0, trimEnd: 5, mirrored: false, videoTitle: URDU_TITLE }),
    ]))
    // Run from the temp folder, so the script doesn't pick up a developer's backend/.env.
    result = await run(process.execPath, [SCRIPT, '--input', input, '--out', outDir, '--local-root', localRoot], { cwd: root, timeout: 120_000 })
  })

  after(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true })
  })

  test('B5: the run makes both clips at category/title/submissionId.mp4, Urdu title included', async () => {
    assert.match(result.stdout, /\n2 made, 0 already there, 0 failed\./)
    assert.match(result.stdout, new RegExp(`Using ffmpeg from ${ffmpeg.source}`))
    const files = (await fs.readdir(outDir, { recursive: true })).map((file) => file.split(path.sep).join('/')).sort()
    assert.deepEqual(files, ['Greetings', 'Greetings/Hello', `Greetings/Hello/${MIRRORED}.mp4`, `Greetings/${URDU_TITLE}`, `Greetings/${URDU_TITLE}/${PLAIN}.mp4`].sort())
  })

  test('B5: each clip is trimmed to its trimStart–trimEnd: 2.00 s and 5.00 s', async () => {
    assert.equal(await durationOf(path.join(outDir, 'Greetings', 'Hello', `${MIRRORED}.mp4`)), 2)
    assert.equal(await durationOf(path.join(outDir, 'Greetings', URDU_TITLE, `${PLAIN}.mp4`)), 5)
  })

  test('B5: the mirrored clip is flipped back (red box on the right); the other is not (red on the left)', async () => {
    const mirrored = await firstFrame(path.join(outDir, 'Greetings', 'Hello', `${MIRRORED}.mp4`))
    assert.ok(isBlue(mirrored(8, 16)), `left of the mirrored clip: ${JSON.stringify(mirrored(8, 16))}`)
    assert.ok(isRed(mirrored(56, 16)), `right of the mirrored clip: ${JSON.stringify(mirrored(56, 16))}`)
    const plain = await firstFrame(path.join(outDir, 'Greetings', URDU_TITLE, `${PLAIN}.mp4`))
    assert.ok(isRed(plain(8, 16)), `left of the plain clip: ${JSON.stringify(plain(8, 16))}`)
    assert.ok(isBlue(plain(56, 16)), `right of the plain clip: ${JSON.stringify(plain(56, 16))}`)
  })

  test('B5: the clips are H.264 MP4 without audio', async () => {
    const { stderr } = await run(ffmpeg.path, ['-hide_banner', '-i', path.join(outDir, 'Greetings', 'Hello', `${MIRRORED}.mp4`)]).catch((error) => error)
    assert.match(stderr, /Video: h264/)
    assert.doesNotMatch(stderr, /Audio:/)
  })
})
