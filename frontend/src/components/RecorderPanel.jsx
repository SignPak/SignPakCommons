import { useEffect, useRef } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { formatTime } from '../utils/format'
import { Alert, Arrow, Button } from './ui'

/** Camera preview, record/stop, delete and re-record for one video. */
export default function RecorderPanel({ video, baseRef, onSaveAndEdit }) {
  const { recording, status, error, elapsed, stream, start, stop, discard } = useRecorder(video.id)
  const live = useRef(null)
  useEffect(() => { if (live.current) live.current.srcObject = stream }, [stream])

  const isRecording = status === 'recording'
  const busy = status === 'requesting'

  // Recording starts the base video too, so contributors can sign along while watching.
  const begin = async () => {
    const started = await start()
    const base = baseRef.current
    if (started && base && (base.paused || base.ended)) base.play().catch(() => {})
  }

  return <div className="recorder">
    <p className={`recorder-status ${isRecording ? 'is-live' : ''}`}><span aria-hidden="true">●</span> {isRecording ? `Recording ${formatTime(elapsed)}` : recording ? 'Recording ready' : 'Your turn'}</p>
    <h2 className="display display-md">Record<br /><em>yourself.</em></h2>
    <p className="recorder-copy">Watch the example, then make it yours. You can review, trim and delete your recording before you submit it.</p>

    <div className="recorder-stage">
      <video ref={live} className={`recorder-video ${isRecording ? '' : 'is-hidden'}`} autoPlay muted playsInline aria-label="Live camera preview" />
      {!isRecording && recording && <video key={recording.url} src={recording.url} className="recorder-video" controls playsInline aria-label="Your recording" />}
      {!isRecording && !recording && <p className="recorder-empty">{busy ? 'Waiting for camera permission…' : 'Your camera preview will appear here.'}</p>}
    </div>

    {isRecording
      ? <Button variant="outline" block onClick={stop}><span><span className="rec-dot" aria-hidden="true">■</span> Stop recording</span></Button>
      : <Button variant="outline" block onClick={begin} disabled={busy}><span><span className="rec-dot" aria-hidden="true">●</span> {recording ? 'Record again' : 'Start recording'}</span></Button>}
    {error && <Alert tone="error">{error}</Alert>}
    {recording && !isRecording && <button type="button" className="recorder-delete" onClick={discard}>Delete recording</button>}
    <Button block className="recorder-save" disabled={!recording || isRecording} onClick={onSaveAndEdit}>Save and edit video <Arrow /></Button>
  </div>
}
