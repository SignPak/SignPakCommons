import { useState } from 'react'
import { DEFAULT_ASPECT, orientationOf } from '../utils/media'
import { join } from './ui/join'

/**
 * A <video> whose window matches the video's own shape. Pass the stored `aspect` (width / height)
 * so the frame is right before the file loads; once the browser reports the real size, that wins.
 * A tall phone video gets a narrow window, a landscape one a wide window, and neither can grow
 * taller than the viewport. Overlays (play buttons, timers) go in `children` and sit inside the frame.
 */
export default function ResponsiveVideo({
  aspect, maxHeight, videoRef, className, frameClassName, children, onAspect, onLoadedMetadata, ...props
}) {
  const [measured, setMeasured] = useState(null)
  const ratio = measured ?? aspect ?? DEFAULT_ASPECT

  const handleMetadata = (event) => {
    const { videoWidth, videoHeight } = event.currentTarget
    if (videoWidth && videoHeight) {
      setMeasured(videoWidth / videoHeight)
      onAspect?.(videoWidth / videoHeight)
    }
    onLoadedMetadata?.(event)
  }

  return (
    <div
      className={join('video-frame', frameClassName)}
      data-orientation={orientationOf(ratio)}
      style={{ '--video-ar': ratio, ...(maxHeight ? { '--video-max-h': maxHeight } : null) }}
    >
      <video ref={videoRef} className={join('video-frame-media', className)} onLoadedMetadata={handleMetadata} {...props} />
      {children}
    </div>
  )
}
