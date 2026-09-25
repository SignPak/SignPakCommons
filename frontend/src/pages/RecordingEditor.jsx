import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TrimSlider from '../components/TrimSlider'
import { Alert, Arrow, Button, ButtonLink, Eyebrow, PageState } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'
import { useNotifications } from '../context/NotificationContext'
import { useRecordings } from '../context/RecordingContext'
import { watchUrl } from '../routes/appRoutes'
import { formatTime } from '../utils/format'

export default function RecordingEditor() {
  const [params] = useSearchParams()
  const videoId = params.get('v')
  return <EditScreen key={videoId} videoId={videoId} />
}

function EditScreen({ videoId }) {
  const { publishedVideos, submitRecording } = useLibrary()
  const { notify } = useNotifications()
  const { recordings, removeRecording, updateEdit } = useRecordings()
  const navigate = useNavigate()
  const video = publishedVideos.find((item) => item.id === videoId)
  const recording = recordings[videoId]

  if (!video) return <PageState eyebrow="Not found" title="That video isn't available." action={<ButtonLink to="/home">Back to library</ButtonLink>}>It may have been unpublished or removed.</PageState>
  if (!recording) return <PageState eyebrow="Nothing to edit" title="Record a take first." action={<ButtonLink to={watchUrl(video.id)}>Back to video</ButtonLink>}>You need a recording before you can trim it.</PageState>

  return <Editor
    video={video} recording={recording}
    onEdit={(patch) => updateEdit(video.id, patch)}
    onSubmit={async () => {
      await submitRecording(video, recording)
      removeRecording(video.id)
      await notify({ type: 'submission', title: 'Recording submitted', body: video.title, href: watchUrl(video.id) })
      navigate(watchUrl(video.id), { state: { justSubmitted: true } })
    }}
  />
}

function Editor({ video, recording, onEdit, onSubmit }) {
  const preview = useRef(null)
  const { start, end, mirrored } = recording.edit
  const total = recording.duration
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(start)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // MediaRecorder files often report an infinite duration until the browser has scanned them once.
  useEffect(() => {
    const element = preview.current
    if (!element) return undefined
    const fix = () => {
      if (element.duration !== Infinity) return
      element.currentTime = 1e101
      element.addEventListener('timeupdate', () => { element.currentTime = start }, { once: true })
    }
    element.addEventListener('loadedmetadata', fix)
    return () => element.removeEventListener('loadedmetadata', fix)
  }, [recording.url, start])

  const togglePlay = () => {
    const element = preview.current
    if (!element.paused) { element.pause(); return }
    if (element.currentTime < start || element.currentTime >= end - 0.05) element.currentTime = start
    element.play().catch(() => {})
  }
  const onTimeUpdate = (event) => {
    const element = event.currentTarget
    setTime(element.currentTime)
    if (!element.paused && element.currentTime >= end) { element.pause(); element.currentTime = end }
  }
  const change = (patch) => {
    onEdit(patch)
    if (preview.current) preview.current.currentTime = patch.start ?? patch.end ?? 0
  }
  const submit = async () => {
    setBusy(true)
    setError('')
    try { await onSubmit() } catch (caught) { setError(caught.message || 'Your recording could not be submitted. Try again.'); setBusy(false) }
  }

  return <main className="page">
    <nav className="shell breadcrumb" aria-label="Breadcrumb"><Link to={watchUrl(video.id)}>← Back to video</Link><span>/</span><b>Edit your recording</b></nav>
    <section className="shell editor-grid">
      <div>
        <Eyebrow>{video.title}</Eyebrow>
        <h1 className="display display-xl">Make it <em>yours.</em></h1>
        <p className="lede">Review your recording before you submit it.</p>
        <div className="editor-stage">
          <video ref={preview} src={recording.url} className={`editor-video ${mirrored ? 'is-mirrored' : ''}`} playsInline onClick={togglePlay}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={onTimeUpdate} aria-label="Preview of your recording" />
          <button type="button" className="editor-play" onClick={togglePlay} aria-label={playing ? 'Pause preview' : 'Play preview'}>{playing ? 'Ⅱ' : '▶'}</button>
          <span className="editor-time">{formatTime(Math.max(time - start, 0))} / {formatTime(end - start)}</span>
        </div>
      </div>

      <aside className="editor-side">
        <h2 className="editor-side-title display display-sm">Trim video</h2>
        <p className="editor-side-copy">Drag the handles to keep only the part you want. Your preview only plays the selected range.</p>
        <TrimSlider total={total} start={start} end={end} onChange={change} />
        <div className="trim-times"><span>Start {formatTime(start)}</span><span>Keeping {formatTime(end - start)}</span><span>End {formatTime(end)}</span></div>
        <label className="toggle"><span>Mirror video</span><input type="checkbox" checked={mirrored} onChange={(event) => onEdit({ mirrored: event.target.checked })} /></label>

        {error && <Alert tone="error">{error}</Alert>}
        {confirming
          ? <div className="confirm">
            <p>Submit this recording? Once submitted it can't be watched, edited or deleted, but you can record this video again after a short cooldown.</p>
            <div className="confirm-actions"><Button onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Yes, submit'}</Button><Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>Keep editing</Button></div>
          </div>
          : <Button block className="editor-submit" onClick={() => setConfirming(true)}>Submit recording <Arrow /></Button>}
        <Link to={watchUrl(video.id)} className="editor-back">Back to player</Link>
      </aside>
    </section>
  </main>
}
