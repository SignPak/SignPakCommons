import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../utils/format'

/** Two-handle range slider. Values are seconds; `total` is the full recording length. */
export default function TrimSlider({ total, start, end, src, mirrored, onChange }) {
  const frameVideo = useRef(null)
  const frameCanvas = useRef(null)
  const latestPreview = useRef(start)
  const [previewTime, setPreviewTime] = useState(start)
  const [showPreview, setShowPreview] = useState(false)

  const drawFrame = useCallback((video) => {
    const canvas = frameCanvas.current
    if (!canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    const context = canvas.getContext('2d')
    if (!context) return
    const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
    const width = video.videoWidth * scale
    const height = video.videoHeight * scale
    context.fillStyle = '#000'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  }, [])

  useEffect(() => {
    latestPreview.current = previewTime
    const video = frameVideo.current
    if (!video || video.readyState < 1 || !Number.isFinite(video.duration)) return
    const target = Math.min(Math.max(previewTime, 0), video.duration)
    if (Math.abs(video.currentTime - target) > 0.08) video.currentTime = target
    else drawFrame(video)
  }, [previewTime, showPreview, drawFrame])

  const onFrameMetadata = (event) => {
    const video = event.currentTarget
    if (video.duration === Infinity) {
      video.currentTime = 1e101
      video.addEventListener('timeupdate', () => {
        video.currentTime = latestPreview.current
      }, { once: true })
      return
    }
    video.currentTime = Math.min(Math.max(latestPreview.current, 0), video.duration)
  }

  const onFrameSeeked = (event) => {
    const video = event.currentTarget
    const target = Math.min(Math.max(latestPreview.current, 0), video.duration)
    if (Math.abs(video.currentTime - target) > 0.08) {
      video.currentTime = target
      return
    }
    drawFrame(video)
  }

  const updatePreview = (event) => {
    const value = Number(event.currentTarget.value)
    latestPreview.current = value
    setPreviewTime(value)
    setShowPreview(true)
  }

  const gap = Math.min(0.5, total / 2)
  const safeTotal = Math.max(total, 0.1)
  const left = (start / safeTotal) * 100
  const right = 100 - (end / safeTotal) * 100
  const previewPosition = (previewTime / safeTotal) * 100

  return <div className="trim" onPointerLeave={() => setShowPreview(false)}>
    <video
      ref={frameVideo}
      className="trim-frame-source"
      src={src}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex="-1"
      onLoadedMetadata={onFrameMetadata}
      onLoadedData={(event) => drawFrame(event.currentTarget)}
      onSeeked={onFrameSeeked}
    />
    {showPreview && <div className="trim-preview" style={{ left: `clamp(4.5rem, ${previewPosition}%, calc(100% - 4.5rem))` }} aria-hidden="true">
      <canvas ref={frameCanvas} className={`trim-preview-frame ${mirrored ? 'is-mirrored' : ''}`} width="144" height="81" />
      <span>{formatTime(previewTime)}</span>
    </div>}
    <div className="trim-track"><span className="trim-fill" style={{ left: `${left}%`, right: `${right}%` }} /></div>
    <input type="range" min="0" max={total} step="0.1" value={start} aria-label="Trim start" aria-valuetext={formatTime(start)} onPointerEnter={updatePreview} onPointerMove={updatePreview} onFocus={updatePreview} onBlur={() => setShowPreview(false)} onChange={(event) => { updatePreview(event); onChange({ start: Math.min(Number(event.target.value), end - gap) }) }} />
    <input type="range" min="0" max={total} step="0.1" value={end} aria-label="Trim end" aria-valuetext={formatTime(end)} onPointerEnter={updatePreview} onPointerMove={updatePreview} onFocus={updatePreview} onBlur={() => setShowPreview(false)} onChange={(event) => { updatePreview(event); onChange({ end: Math.max(Number(event.target.value), start + gap) }) }} />
  </div>
}
