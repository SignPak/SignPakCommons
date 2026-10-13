import { useEffect, useRef, useState } from 'react'
import { formatBytes, formatTime } from '../utils/format'
import { inspectVideoFile } from '../utils/media'
import { processVideo } from '../utils/processVideo'
import ResponsiveVideo from './ResponsiveVideo'
import TrimSlider from './TrimSlider'
import { Alert, Button } from './ui'

const sameRange = (range, total) => range.start <= 0.05 && range.end >= total - 0.05

/**
 * Admin step between choosing a file and uploading it: the window follows the video's shape,
 * sound can be removed, unwanted start/end frames can be trimmed, and only then is the clip
 * marked ready. `onReady(prepared)` receives { file, durationSec, width, height, poster };
 * `onReset()` fires as soon as the admin changes anything after that.
 */
export default function VideoPrep({ file, label, onReady, onReset }) {
  const player = useRef(null)
  const [source, setSource] = useState('')
  const [duration, setDuration] = useState(0)
  const [aspect, setAspect] = useState(null)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const [removeAudio, setRemoveAudio] = useState(true)
  const [status, setStatus] = useState('editing') // editing | working | ready
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [error, setError] = useState('')

  // The chosen file is previewed from a local object URL; the result gets its own.
  const [resultUrl, setResultUrl] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an object URL must be created and revoked alongside the effect, so StrictMode's re-run gets a fresh one
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl) }, [resultUrl])

  const trimmable = Number.isFinite(duration) && duration > 0
  const trimmed = trimmable && !sameRange(range, duration)
  const nothingToDo = !removeAudio && !trimmed

  const onMetadata = (event) => {
    const total = event.currentTarget.duration
    setDuration(total)
    if (Number.isFinite(total)) setRange({ start: 0, end: Math.round(total * 10) / 10 })
  }

  const edit = (patch) => {
    setRange((current) => ({ ...current, ...patch }))
    setError('')
    if (player.current) player.current.currentTime = patch.start ?? patch.end ?? range.start
  }

  const stopAtRangeEnd = (event) => {
    const element = event.currentTarget
    if (status === 'editing' && trimmed && !element.paused && element.currentTime >= range.end) {
      element.pause()
      element.currentTime = range.end
    }
  }
  const startAtRangeStart = () => {
    const element = player.current
    if (status === 'editing' && trimmed && (element.currentTime < range.start || element.currentTime >= range.end - 0.05)) {
      element.currentTime = range.start
    }
  }

  const prepare = async () => {
    setError('')
    if (nothingToDo) {
      const meta = await inspectVideoFile(file)
      setResult({ file, ...meta })
      setStatus('ready')
      onReady({ file, ...meta })
      return
    }
    setStatus('working')
    setProgress(0)
    try {
      const processed = await processVideo(
        file,
        { removeAudio, trim: trimmed ? { start: range.start, end: range.end } : null },
        setProgress,
      )
      const meta = await inspectVideoFile(processed)
      setResultUrl(URL.createObjectURL(processed))
      setResult({ file: processed, ...meta })
      setStatus('ready')
      onReady({ file: processed, ...meta })
    } catch {
      setStatus('editing')
      setError('This browser could not process the video (it may be too large, or the editor could not be loaded). Check your connection and try again, or upload the original unchanged by turning off “Remove sound” and keeping the full length.')
    }
  }

  const editAgain = () => {
    setStatus('editing')
    setResult(null)
    setResultUrl('')
    onReset()
  }

  const showingResult = status === 'ready' && resultUrl
  const shownUrl = showingResult ? resultUrl : source

  if (previewFailed) {
    return <Alert tone="info">This browser could not preview the file. You can still upload it unchanged; playback depends on its video format and codec. Try Chrome or Edge to trim it.</Alert>
  }

  return (
    <div className="prep">
      <ResponsiveVideo
        key={shownUrl}
        videoRef={player}
        src={shownUrl}
        aspect={aspect}
        onAspect={setAspect}
        frameClassName="prep-frame"
        controls
        muted
        playsInline
        onPlay={startAtRangeStart}
        onTimeUpdate={stopAtRangeEnd}
        onLoadedMetadata={showingResult ? undefined : onMetadata}
        onError={() => setPreviewFailed(true)}
        aria-label={label ? `Preview of ${label}` : 'Preview of the selected video'}
      />

      {status !== 'ready' && trimmable && (
        <div className="prep-trim">
          <p className="prep-title">Trim</p>
          <TrimSlider total={duration} start={range.start} end={range.end} src={source} aspect={aspect} onChange={edit} />
          <div className="trim-times">
            <span>Start {formatTime(range.start)}</span>
            <span>Keeping {formatTime(range.end - range.start)}</span>
            <span>End {formatTime(range.end)}</span>
          </div>
        </div>
      )}

      {status !== 'ready' && (
        <label className="toggle">
          <span>Remove sound</span>
          <input type="checkbox" checked={removeAudio} onChange={(event) => { setRemoveAudio(event.target.checked); setError('') }} disabled={status === 'working'} />
        </label>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {status === 'editing' && (
        <Button type="button" variant="outline" block onClick={prepare} disabled={!trimmable && !removeAudio}>
          {nothingToDo ? 'Use the video as it is' : 'Apply changes'}
        </Button>
      )}

      {status === 'working' && (
        <div className="prep-progress" role="status" aria-live="polite">
          <progress max="1" value={progress} aria-label="Processing the video" />
          <span>Processing in your browser… {Math.round(progress * 100)}%</span>
        </div>
      )}

      {status === 'ready' && result && (
        <div className="prep-ready" role="status">
          <p>
            <b>Ready to upload.</b> {result.width && result.height ? `${result.width} × ${result.height}` : 'Size unknown'} · {formatTime(result.durationSec)} · {formatBytes(result.file.size)}
            {result.file !== file && ` (was ${formatBytes(file.size)})`}
            {removeAudio && ' · no sound'}
          </p>
          <button type="button" className="link-accent" onClick={editAgain}>Edit again</button>
        </div>
      )}
    </div>
  )
}
