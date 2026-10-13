export const DEFAULT_ASPECT = 16 / 9

/** Width / height from a stored or measured size, or null when either side is unknown. */
export function aspectOf(size) {
  const width = Number(size?.width)
  const height = Number(size?.height)
  return width > 0 && height > 0 ? width / height : null
}

export const orientationOf = (aspect) => (aspect < 0.95 ? 'portrait' : aspect > 1.05 ? 'landscape' : 'square')

/**
 * Reads duration and displayed size, and grabs a poster frame from a local video file so the
 * admin library has a thumbnail without any server-side processing.
 * `videoWidth`/`videoHeight` already account for a phone's rotation flag.
 */
export function inspectVideoFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const empty = { durationSec: 0, width: 0, height: 0, poster: '' }
    const finish = (result) => { URL.revokeObjectURL(url); resolve(result) }
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onerror = () => finish(empty)
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2)
    }
    video.onseeked = () => {
      const base = {
        durationSec: Math.round(video.duration || 0),
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      }
      try {
        const canvas = document.createElement('canvas')
        // Longest side 640px, so portrait posters are as sharp as landscape ones.
        const scale = 640 / Math.max(video.videoWidth || 1, video.videoHeight || 1)
        canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale))
        canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale))
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        finish({ ...base, poster: canvas.toDataURL('image/jpeg', 0.7) })
      } catch {
        finish({ ...base, poster: '' })
      }
    }
    video.src = url
  })
}
