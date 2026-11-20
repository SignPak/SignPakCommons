import fs from 'node:fs/promises'

/** Best-effort delete; a missing file is fine. */
export const removeQuietly = async (path) => { if (path) await fs.unlink(path).catch(() => {}) }

export const safeName = (value, fallback = 'Untitled') =>
  String(value ?? '').replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || fallback

async function readHead(path, length = 16) {
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally { await handle.close() }
}

// B6: brands of the ISO base-media family (MP4, MOV, ...) that are video we accept.
const VIDEO_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'qt  '])
// Same container, not a video we want: audio, still images, and 3GP/3G2 phone video.
const REJECTED_BRANDS = new Set(['M4A ', 'M4B ', 'heic', 'heix', 'mif1', 'msf1', 'avif'])
const isRejectedBrand = (brand) => REJECTED_BRANDS.has(brand) || brand.startsWith('3gp') || brand.startsWith('3g2')
const MP4 = { mimeType: 'video/mp4', ext: '.mp4' }
const MOV = { mimeType: 'video/quicktime', ext: '.mov' }

/**
 * Brands from an ftyp box: [major, ...compatible]. The box is: size (4) "ftyp" major (4)
 * minor version (4) compatible brands (4 each). Only brands inside both the box and the bytes
 * we read count; size 0 means "the box runs to the end of the file".
 */
function ftypBrands(head) {
  const declared = head.readUInt32BE(0)
  const end = Math.min(head.length, declared === 0 ? head.length : declared)
  const brands = [head.toString('latin1', 8, 12)]
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(head.toString('latin1', offset, offset + 4))
  return brands
}

/**
 * Identifies a video by its first bytes instead of trusting the browser-supplied
 * Content-Type or file name. Returns { mimeType, ext } or null.
 *
 * MP4-family files are accepted by brand (B6): a rejected major brand (M4A audio, HEIC/AVIF
 * images, 3GP) is refused; a listed major brand is accepted; an unknown major brand is accepted
 * only if one of its compatible brands (within the first 32 bytes) is a listed video brand and
 * none is a rejected one. That keeps real camera clips with unusual major brands (e.g. Sony's
 * XAVC, compatible with mp42) while keeping audio, photos and 3GP out.
 */
export async function sniffVideo(path) {
  const head = await readHead(path, 32)
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return { mimeType: 'video/webm', ext: '.webm' }
  if (head.length < 12 || head.toString('ascii', 4, 8) !== 'ftyp') return null

  const [major, ...compatible] = ftypBrands(head)
  if (isRejectedBrand(major)) return null
  if (VIDEO_BRANDS.has(major)) return major === 'qt  ' ? MOV : MP4
  if (compatible.some(isRejectedBrand)) return null
  if (!compatible.some((brand) => VIDEO_BRANDS.has(brand))) return null
  return compatible.includes('qt  ') ? MOV : MP4
}

export async function sniffImage(path) {
  const head = await readHead(path)
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mimeType: 'image/jpeg', ext: '.jpg' }
  if (head.length >= 8 && head.readUInt32BE(0) === 0x89504e47) return { mimeType: 'image/png', ext: '.png' }
  if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') return { mimeType: 'image/webp', ext: '.webp' }
  return null
}
