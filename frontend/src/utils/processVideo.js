/**
 * Browser-side video preparation with ffmpeg.wasm: drops the audio track and cuts away
 * unwanted frames, so the server only ever stores the clip that will be shown.
 * The library is loaded on first use, so contributors never download it.
 *
 * S8: the core (@ffmpeg/core, pinned in package.json) is served by the site itself from /ffmpeg
 * (scripts/copyFfmpegCore.js), never a CDN. The worker imports it and fetches the .wasm from
 * the site's own origin, which the CSP allows ('self', 'wasm-unsafe-eval').
 */
const CORE_BASE = '/ffmpeg'

let loading = null

function loadFfmpeg() {
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const ffmpeg = new FFmpeg()
      // Absolute URLs: the worker resolves them against its own script URL, not the page.
      await ffmpeg.load({
        coreURL: new URL(`${CORE_BASE}/ffmpeg-core.js`, window.location.origin).href,
        wasmURL: new URL(`${CORE_BASE}/ffmpeg-core.wasm`, window.location.origin).href,
      })
      return ffmpeg
    })().catch((error) => {
      loading = null // allow a retry after a network failure
      throw error
    })
  }
  return loading
}

const extensionOf = (name) => (/\.(mp4|webm|mov)$/i.exec(name)?.[1] || 'mp4').toLowerCase()
const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

/**
 * @param {File} file
 * @param {{ removeAudio: boolean, trim: null | { start: number, end: number } }} options
 * @param {(fraction: number) => void} [onProgress]
 * @returns {Promise<File>} a new file; the original is never changed.
 */
export async function processVideo(file, { removeAudio, trim }, onProgress) {
  const ffmpeg = await loadFfmpeg()
  const ext = extensionOf(file.name)
  const input = `input.${ext}`
  // Cutting needs a re-encode to be frame-accurate, and H.264 in MP4 plays everywhere.
  const outExt = trim ? 'mp4' : ext
  const output = `output.${outExt}`
  const handleProgress = ({ progress }) => onProgress?.(Math.min(Math.max(progress, 0), 1))
  ffmpeg.on('progress', handleProgress)
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))
    const args = []
    if (trim) args.push('-ss', trim.start.toFixed(2))
    args.push('-i', input)
    if (trim) args.push('-t', Math.max(trim.end - trim.start, 0.1).toFixed(2))
    if (removeAudio) args.push('-an')
    if (trim) {
      args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p')
      if (!removeAudio) args.push('-c:a', 'aac')
    } else {
      args.push('-c', 'copy')
    }
    if (outExt !== 'webm') args.push('-movflags', '+faststart')
    args.push(output)
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new Error('The video could not be processed.')
    const data = await ffmpeg.readFile(output)
    if (!data?.length) throw new Error('The video could not be processed.')
    const name = `${file.name.replace(/\.[^.]+$/, '')}.${outExt}`
    return new File([data], name, { type: MIME[outExt] })
  } finally {
    ffmpeg.off('progress', handleProgress)
    await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)])
  }
}
