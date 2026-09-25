import fs from 'node:fs/promises'

/** Best-effort delete; a missing file is fine. */
export const removeQuietly = async (path) => { if (path) await fs.unlink(path).catch(() => {}) }

async function readHead(path, length = 16) {
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, 0)
    return buffer.subarray(0, bytesRead)
  } finally { await handle.close() }
}

/**
 * Identifies a video by its first bytes instead of trusting the browser-supplied
 * Content-Type or file name. Returns { mimeType, ext } or null.
 */
export async function sniffVideo(path) {
  const head = await readHead(path)
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return { mimeType: 'video/webm', ext: '.webm' }
  if (head.length >= 12 && head.toString('ascii', 4, 8) === 'ftyp') {
    const brand = head.toString('ascii', 8, 12)
    return brand === 'qt  ' ? { mimeType: 'video/quicktime', ext: '.mov' } : { mimeType: 'video/mp4', ext: '.mp4' }
  }
  return null
}

export async function sniffImage(path) {
  const head = await readHead(path)
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mimeType: 'image/jpeg', ext: '.jpg' }
  if (head.length >= 8 && head.readUInt32BE(0) === 0x89504e47) return { mimeType: 'image/png', ext: '.png' }
  if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') return { mimeType: 'image/webp', ext: '.webp' }
  return null
}
