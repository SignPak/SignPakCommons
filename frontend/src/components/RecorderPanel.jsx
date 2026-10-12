import { useEffect, useRef, useState } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { formatTime } from '../utils/format'
import { Alert, Arrow, Button } from './ui'

/** Camera preview, record/stop, delete and re-record for one video. */
export default function RecorderPanel({ video, baseRef, onSaveAndEdit }) {
  const { recording, status, error, elapsed, stream, prepare, start, stop, discard } = useRecorder(video.id)
  const live = useRef(null)
  const countdownTimer = useRef(null)
  const starting = useRef(false)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => { 
    if (live.current) live.current.srcObject = stream 
  }, [stream])

  useEffect(() => () => clearTimeout(countdownTimer.current), [])

  const isRecording = status === 'recording'
  const busy = status === 'requesting' || countdown !== null
  const showCameraPreview = isRecording || countdown !== null || (!recording && stream)

  // Recording starts the base video too, so contributors can sign along while watching.
  const startCapture = async () => {
    const started = await start()
    const base = baseRef.current
    if (started && base && (base.paused || base.ended)) base.play().catch(() => {})
  }
  const begin = async () => {
    if (busy || starting.current) return
    starting.current = true
    const ready = await prepare()
    if (!ready) {
      starting.current = false
      return
    }
    let remaining = 3
    setCountdown(remaining)
    const tick = () => {
      remaining -= 1
      if (remaining === 0) {
        setCountdown(null)
        starting.current = false
        startCapture()
        return
      }
      setCountdown(remaining)
      countdownTimer.current = setTimeout(tick, 1000)
    }
    countdownTimer.current = setTimeout(tick, 1000)
  }

  return (
    <div className="recorder">
      <p className={`recorder-status ${isRecording ? 'is-live' : ''}`}>
        <span aria-hidden="true">●</span> 
        {isRecording ? `Recording ${formatTime(elapsed)}` : countdown !== null ? `Starting in ${countdown}…` : recording ? 'Recording ready' : 'Your turn'}
      </p>
      
      <h2 className="display display-md">Record<br /><em>yourself.</em></h2>
      <p className="recorder-copy">Watch the example, then make it yours. You can review, trim and delete your recording before you submit it.</p>

      <div className="recorder-stage">
        <video ref={live} className={`recorder-video ${showCameraPreview ? '' : 'is-hidden'}`} autoPlay muted playsInline aria-label="Live camera preview" />
        {!isRecording && recording && countdown === null && <video key={recording.url} src={recording.url} className="recorder-video" controls playsInline aria-label="Your recording" />}
        {!isRecording && !recording && !stream && <p className="recorder-empty">{busy ? 'Waiting for camera permission…' : 'Your camera preview will appear here.'}</p>}
        {countdown !== null && (
          <div className="recorder-countdown" role="status" aria-live="assertive">
            <strong>{countdown}</strong>
            <span>Get ready</span>
          </div>
        )}
      </div>

      {isRecording ? (
        <Button variant="outline" block onClick={stop}>
          <span><span className="rec-dot" aria-hidden="true">■</span> Stop recording</span>
        </Button>
      ) : (
        <Button variant="outline" block onClick={begin} disabled={busy}>
          <span><span className="rec-dot" aria-hidden="true">●</span> {countdown !== null ? `Starting in ${countdown}…` : recording ? 'Record again' : 'Start recording'}</span>
        </Button>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {recording && !isRecording && <button type="button" className="recorder-delete" onClick={discard}>Delete recording</button>}
      
      <Button block className="recorder-save" disabled={!recording || isRecording} onClick={onSaveAndEdit}>
        Save and edit video <Arrow />
      </Button>
    </div>
  )
}
