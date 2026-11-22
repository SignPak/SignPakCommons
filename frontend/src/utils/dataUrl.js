/**
 * S8: turns a data: URL (the canvas poster from inspectVideoFile) into a Blob in memory.
 * fetch('data:…') would do the same, but the CSP's connect-src does not allow data:.
 */
export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^,]*?),(.*)$/s.exec(String(dataUrl))
  if (!match) throw new Error('Not a data URL.')
  const [, meta, payload] = match
  const isBase64 = /;base64$/i.test(meta)
  const type = (isBase64 ? meta.slice(0, -';base64'.length) : meta).split(';')[0] || 'text/plain'
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type })
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
