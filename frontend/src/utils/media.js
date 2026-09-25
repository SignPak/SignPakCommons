/**
 * Reads duration and grabs a poster frame from a local video file so the admin
 * library has a thumbnail without any server-side processing.
 */
export function inspectVideoFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (result) => { URL.revokeObjectURL(url); resolve(result) }
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onerror = () => finish({ duration: 0, poster: '' })
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const width = 640
        canvas.width = width
        canvas.height = Math.round((video.videoHeight / (video.videoWidth || 1)) * width) || 360
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        finish({ duration: Math.round(video.duration || 0), poster: canvas.toDataURL('image/jpeg', 0.7) })
      } catch {
        finish({ duration: Math.round(video.duration || 0), poster: '' })
      }
    }
    video.src = url
  })
}
