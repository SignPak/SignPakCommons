import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BasePlayer from '../components/BasePlayer'
import RecorderPanel from '../components/RecorderPanel'
import { Alert, Button, ButtonLink, Eyebrow, PageState } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'
import { categoryUrl, paths, watchEditUrl, watchUrl } from '../routes/appRoutes'
import { safeRouteId } from '../utils/validators'

export default function Player() {
  const [params] = useSearchParams()
  const videoId = safeRouteId(params.get('v'))
  // Keyed so switching videos (Next video, another category) resets the player and the camera.
  return <PlayerScreen key={videoId} videoId={videoId} />
}

/** Live "you can record again in Ns" countdown from a fixed past timestamp. Returns 0 once it has elapsed. */
function useCooldown(lastAt, cooldownMs) {
  const compute = () => (lastAt ? Math.max(0, cooldownMs - (Date.now() - lastAt)) : 0)
  const [remaining, setRemaining] = useState(compute)
  useEffect(() => {
    if (!lastAt) return undefined
    const id = setInterval(() => setRemaining(compute()), 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `compute` is intentionally re-created each render; only lastAt/cooldownMs should restart the interval
  }, [lastAt, cooldownMs])
  return remaining
}

function PlayerScreen({ videoId }) {
  const { publishedVideos, categories, videosIn, submissionCount, lastSubmissionAt, nextVideo, cooldownMs, refresh } = useLibrary()
  const navigate = useNavigate()
  const location = useLocation()
  const baseRef = useRef(null)
  const video = publishedVideos.find((item) => item.id === videoId)

  const [justSubmitted, setJustSubmitted] = useState(Boolean(location.state?.justSubmitted))
  useEffect(() => {
    if (!justSubmitted) return undefined
    const timer = setTimeout(() => setJustSubmitted(false), 5000)
    return () => clearTimeout(timer)
  }, [justSubmitted])

  const remaining = useCooldown(video ? lastSubmissionAt(video.id) : null, cooldownMs)
  // The countdown only ever counts down, so a fresh 0 -> refresh library data to reflect the new submission in badges/counts.
  const wasCoolingDown = useRef(false)
  useEffect(() => {
    if (remaining > 0) wasCoolingDown.current = true
    else if (wasCoolingDown.current) { wasCoolingDown.current = false; refresh() }
  }, [remaining, refresh])

  if (!video) {
    return <PageState eyebrow="Not found" title="That video isn't available." action={<ButtonLink to={paths.library}>Back to library</ButtonLink>}>It may have been unpublished or removed.</PageState>
  }

  const category = categories.find((item) => item.id === video.categoryId)
  const number = videosIn(video.categoryId).findIndex((item) => item.id === video.id) + 1
  const count = submissionCount(video.id)
  const next = nextVideo(video)
  const goNext = () => navigate(next ? watchUrl(next.id) : categoryUrl(video.categoryId))
  const seconds = Math.ceil(remaining / 1000)

  return <main className="page">
    <div className="shell player-top"><Link to={categoryUrl(video.categoryId)}>← Back to videos</Link><span>{video.level} · Video {String(number).padStart(2, '0')}</span></div>
    <section className="shell player-grid">
      <div>
        <BasePlayer video={video} videoRef={baseRef} />
        <div className="player-meta">
          <div><Eyebrow>{category?.label}</Eyebrow><h1 className="display display-lg">{video.title}</h1></div>
          <Button variant="outline" onClick={goNext}>{next ? 'Next video →' : 'Back to videos'}</Button>
        </div>
        {justSubmitted && <Alert tone="success">Recording received — thank you for contributing.</Alert>}
      </div>
      <aside className="player-side">
        {remaining > 0
          ? <div className="cooldown">
            <p className="recorder-status"><span aria-hidden="true">✓</span> {count > 1 ? `Recorded ${count} times` : 'Recorded'}</p>
            <h2 className="display display-md">Nice work.<br /><em>Rest a moment.</em></h2>
            <p className="recorder-copy">To keep every take a genuine, separate recording, you can record this video again in <b>{seconds}s</b>.</p>
            <div className="cooldown-ring" role="status" aria-label={`${seconds} seconds until you can record again`}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="44" className="cooldown-track" />
                <circle cx="50" cy="50" r="44" className="cooldown-progress" style={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - remaining / cooldownMs) }} />
              </svg>
              <span>{seconds}</span>
            </div>
            <Button block onClick={goNext}>{next ? 'Next video' : 'Back to videos'} →</Button>
          </div>
          : <RecorderPanel video={video} baseRef={baseRef} onSaveAndEdit={() => navigate(watchEditUrl(video.id))} />}
      </aside>
    </section>
  </main>
}
