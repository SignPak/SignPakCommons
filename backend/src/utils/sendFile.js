/**
 * Streams a stored file with HTTP Range support, which browsers need for seeking inside <video>.
 * `file` is a descriptor from the storage layer: { size, mimeType, createReadStream({ start, end }) }.
 */
export async function sendFile(req, res, file, { cache = 'private, max-age=3600' } = {}) {
  const { size, mimeType } = file
  let start = 0
  let end = size - 1
  let partial = false

  const header = req.headers.range
  if (header) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header)
    if (!match || (match[1] === '' && match[2] === '')) return rangeNotSatisfiable(res, size)
    if (match[1] === '') {
      start = Math.max(size - Number(match[2]), 0)
    } else {
      start = Number(match[1])
      if (match[2] !== '') end = Math.min(Number(match[2]), size - 1)
    }
    if (start > end || start >= size) return rangeNotSatisfiable(res, size)
    partial = true
  }

  // Open the stream BEFORE touching headers, so a storage failure produces a clean error response.
  const stream = size === 0 || req.method === 'HEAD' ? null : await file.createReadStream({ start, end })

  res.status(partial ? 206 : 200)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  res.setHeader('Content-Length', size === 0 ? 0 : end - start + 1)
  if (!stream) return res.end()

  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

function rangeNotSatisfiable(res, size) {
  res.status(416)
  res.setHeader('Content-Range', `bytes */${size}`)
  return res.end()
}
