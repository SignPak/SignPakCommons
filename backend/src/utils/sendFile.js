/**
 * Streams a stored file with HTTP Range support, which browsers need for seeking inside <video>.
 * `file` is a descriptor from the storage layer: { size, mimeType, createReadStream({ start, end }) }.
 */
export function sendFile(req, res, file, { cache = 'private, max-age=3600' } = {}) {
  const { size, mimeType } = file
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')

  let start = 0
  let end = size - 1
  const header = req.headers.range
  if (header) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(header)
    if (!match || (match[1] === '' && match[2] === '')) return rangeNotSatisfiable(res, size)
    if (match[1] === '') { // "last N bytes"
      start = Math.max(size - Number(match[2]), 0)
    } else {
      start = Number(match[1])
      if (match[2] !== '') end = Math.min(Number(match[2]), size - 1)
    }
    if (start > end || start >= size) return rangeNotSatisfiable(res, size)
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  }

  res.setHeader('Content-Length', end - start + 1)
  if (req.method === 'HEAD' || size === 0) return res.end()

  const stream = file.createReadStream({ start, end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

function rangeNotSatisfiable(res, size) {
  res.status(416)
  res.setHeader('Content-Range', `bytes */${size}`)
  return res.end()
}
