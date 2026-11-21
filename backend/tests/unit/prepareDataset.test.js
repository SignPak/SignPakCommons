import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, test } from 'node:test'
import { buildFfmpegArgs, outputPathFor, runDataset } from '../../scripts/prepare-dataset.js'

/**
 * B5: the dataset script turns the export into trimmed, mirrored clips with ffmpeg. These tests
 * check the ffmpeg arguments and the run loop with a faked download and a faked ffmpeg, so no
 * real ffmpeg or Drive access is needed.
 */

const row = (fields) => ({
  submissionId: 'sub-1', userId: 'u1', videoId: 'v1', videoTitle: 'Hello', categoryId: 'c1', categoryLabel: 'Greetings',
  driveFileId: 'drive-1', archivePath: null, mimeType: 'video/webm', size: 10, duration: 5,
  trimStart: 1, trimEnd: 3.5, mirrored: false, submittedAt: '2026-11-22T10:00:00.000Z', storageDriver: 'gdrive-archive', ...fields,
})

describe('B5: prepare-dataset ffmpeg arguments', () => {
  test('B5: a trim seeks to trimStart and keeps trimEnd - trimStart seconds, without audio', () => {
    assert.deepEqual(buildFfmpegArgs({ input: 'in.webm', output: 'out.mp4', trimStart: 1, trimEnd: 3.5, mirrored: false }), [
      '-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', 'in.webm', '-t', '2.5',
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', 'out.mp4',
    ])
  })

  test('B5: a mirrored recording is flipped horizontally', () => {
    const args = buildFfmpegArgs({ input: 'in.webm', output: 'out.mp4', trimStart: 0, trimEnd: 2, mirrored: true })
    const filter = args.indexOf('-vf')
    assert.ok(filter > args.indexOf('-i'), 'the filter is an output option')
    assert.equal(args[filter + 1], 'hflip')
    assert.equal(args[args.indexOf('-ss') + 1], '0')
  })

  test('B5: decimal trims keep millisecond precision and no floating-point noise', () => {
    const args = buildFfmpegArgs({ input: 'in', output: 'out', trimStart: 0.1, trimEnd: 0.3, mirrored: false })
    assert.equal(args[args.indexOf('-ss') + 1], '0.1')
    assert.equal(args[args.indexOf('-t') + 1], '0.2')
  })

  test('B5: a trim that is empty or reversed is refused', () => {
    assert.throws(() => buildFfmpegArgs({ input: 'in', output: 'out', trimStart: 3, trimEnd: 3, mirrored: false }), /trim/)
    assert.throws(() => buildFfmpegArgs({ input: 'in', output: 'out', trimStart: 4, trimEnd: 3, mirrored: false }), /trim/)
  })

  test('B5: the output is <category>/<video>/<submissionId>.mp4 with safe folder names', () => {
    assert.equal(outputPathFor('/data', row({})), path.join('/data', 'Greetings', 'Hello', 'sub-1.mp4'))
    const unsafe = outputPathFor('/data', row({ categoryLabel: 'a/b:c', videoTitle: '..\\x?' }))
    assert.equal(path.dirname(path.dirname(path.dirname(unsafe))), path.normalize('/data'), 'stays two folders under the output')
    assert.equal(/[/\\:?]/.test(path.relative('/data', unsafe).split(path.sep).slice(0, 2).join('')), false)
    assert.equal(outputPathFor('/data', row({ categoryLabel: null, videoTitle: '' })), path.join('/data', 'Unassigned', 'Untitled', 'sub-1.mp4'))
    const dots = outputPathFor('/data', row({ categoryLabel: '..', videoTitle: '.' }))
    assert.equal(path.relative('/data', dots).startsWith('..'), false, 'a ".." name cannot climb out of the output folder')
    assert.equal(path.dirname(path.dirname(path.dirname(dots))), path.normalize('/data'))
  })
})

describe('B5: prepare-dataset run', () => {
  const fakes = (overrides = {}) => {
    const calls = { fetched: [], ffmpeg: [] }
    return {
      calls,
      deps: {
        outDir: '/data',
        tempDir: '/tmp/x',
        exists: async () => false,
        fetchFile: async (item, tempPath) => { calls.fetched.push([item.submissionId, tempPath]) },
        runFfmpeg: async (args) => { calls.ffmpeg.push(args) },
        removeFile: async () => {},
        log: () => {},
        ...overrides,
      },
    }
  }

  test('B5: every row is downloaded and converted, and the summary counts them', async () => {
    const { calls, deps } = fakes()
    const summary = await runDataset([row({}), row({ submissionId: 'sub-2', mirrored: true })], deps)
    assert.deepEqual(summary, { done: 2, skipped: 0, failed: [] })
    assert.deepEqual(calls.fetched.map(([id]) => id), ['sub-1', 'sub-2'])
    assert.ok(calls.ffmpeg[1].includes('hflip'))
  })

  test('B5: a clip that already exists is skipped unless overwrite is set', async () => {
    const { calls, deps } = fakes({ exists: async (file) => file.endsWith('sub-1.mp4') })
    assert.deepEqual(await runDataset([row({}), row({ submissionId: 'sub-2' })], deps), { done: 1, skipped: 1, failed: [] })
    assert.deepEqual(calls.fetched.map(([id]) => id), ['sub-2'])
    const again = fakes({ exists: async () => true })
    assert.deepEqual(await runDataset([row({})], { ...again.deps, overwrite: true }), { done: 1, skipped: 0, failed: [] })
  })

  test('B5: a failed row is reported and the run carries on', async () => {
    const { deps } = fakes({ fetchFile: async (item) => { if (item.submissionId === 'sub-1') throw new Error('Drive said 404') } })
    const summary = await runDataset([row({}), row({ submissionId: 'sub-2' })], deps)
    assert.equal(summary.done, 1)
    assert.deepEqual(summary.failed, [{ submissionId: 'sub-1', reason: 'Drive said 404' }])
  })
})
