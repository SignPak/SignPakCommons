import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { sniffVideo } from '../../src/utils/files.js'
import { temporaryDirectory } from '../support/videoServiceTestHelpers.js'

/**
 * B6: an MP4/MOV-family file starts with an `ftyp` box: size (4 bytes), "ftyp", the major
 * brand (4), a minor version (4), then compatible brands (4 each). Audio (M4A), photos
 * (HEIC/AVIF) and 3GP use the same container, so the brands decide what is a video.
 */

/** An ftyp box with the given major brand and compatible brands, plus some payload. */
function ftyp(major, compatible = [], { size } = {}) {
  const brands = [major, ...compatible].map((brand) => Buffer.from(brand, 'latin1'))
  const body = Buffer.concat([Buffer.from('ftyp'), brands[0], Buffer.alloc(4), ...brands.slice(1)])
  const header = Buffer.alloc(4)
  header.writeUInt32BE(size ?? body.length + 4)
  return Buffer.concat([header, body, Buffer.alloc(64, 7)])
}

async function sniff(t, bytes) {
  const directory = await temporaryDirectory(t)
  const file = path.join(directory, 'upload.bin')
  await fs.writeFile(file, bytes)
  return sniffVideo(file)
}

const MP4 = { mimeType: 'video/mp4', ext: '.mp4' }
const MOV = { mimeType: 'video/quicktime', ext: '.mov' }

test('B6: accepts every listed video major brand', async (t) => {
  for (const brand of ['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ']) {
    assert.deepEqual(await sniff(t, ftyp(brand)), MP4, brand)
  }
  assert.deepEqual(await sniff(t, ftyp('qt  ')), MOV)
})

test('B6: rejects audio, image and 3GP major brands even when they list video brands', async (t) => {
  for (const brand of ['M4A ', 'M4B ', 'heic', 'heix', 'mif1', 'msf1', 'avif', '3gp4', '3gp5', '3gp6', '3g2a', '3g2b']) {
    // Real files of these kinds often list isom/mp42 as compatible: the major brand still wins.
    assert.equal(await sniff(t, ftyp(brand, ['isom', 'mp42'])), null, brand)
  }
})

test('B6: an unknown major brand is accepted only through a listed compatible brand', async (t) => {
  // A Sony camera clip: major XAVC, compatible with mp42/iso2.
  assert.deepEqual(await sniff(t, ftyp('XAVC', ['mp42', 'iso2'])), MP4)
  // A QuickTime-compatible file with an unusual major brand.
  assert.deepEqual(await sniff(t, ftyp('abcd', ['qt  '])), MOV)
  // Nothing recognisable at all.
  assert.equal(await sniff(t, ftyp('abcd', ['wxyz'])), null)
  assert.equal(await sniff(t, ftyp('abcd')), null)
})

test('B6: a rejected compatible brand vetoes an unknown major brand', async (t) => {
  assert.equal(await sniff(t, ftyp('abcd', ['mp42', 'heic'])), null)
  assert.equal(await sniff(t, ftyp('abcd', ['isom', '3gp4'])), null)
})

test('B6: compatible brands past the end of the ftyp box are ignored', async (t) => {
  // The box declares 16 bytes (no compatible brands); the "mp42" after it belongs to the next box.
  const bytes = ftyp('abcd', ['mp42'], { size: 16 })
  assert.equal(await sniff(t, bytes), null)
})

test('B6: box size 0 (box runs to end of file) and short files are handled', async (t) => {
  assert.deepEqual(await sniff(t, ftyp('isom', [], { size: 0 })), MP4)
  assert.deepEqual(await sniff(t, ftyp('abcd', ['mp42'], { size: 0 })), MP4)
  // Just the 12-byte header the older fixtures use.
  assert.deepEqual(await sniff(t, Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')])), MP4)
  assert.equal(await sniff(t, Buffer.from('ftyp')), null)
  assert.equal(await sniff(t, Buffer.alloc(0)), null)
})

test('B6: WebM is still recognised and other content is still rejected', async (t) => {
  assert.deepEqual(await sniff(t, Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20)])), { mimeType: 'video/webm', ext: '.webm' })
  assert.equal(await sniff(t, Buffer.from('plain text pretending to be a video')), null)
  assert.equal(await sniff(t, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)])), null)
})
