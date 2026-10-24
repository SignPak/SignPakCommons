import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BasePlayer from '../components/BasePlayer'
import RecorderPanel from '../components/RecorderPanel'
import { Alert, Button, ButtonLink, Eyebrow, PageState } from '../components/ui'
import { useCachedVideo } from '../hooks/useCachedVideo'
import { useLibrary } from '../context/LibraryContext'
import { useUploadQueue } from '../context/UploadQueueContext'
import { categoryUrl, paths, watchEditUrl, watchUrl } from '../routes/appRoutes'
import { aspectOf, orientationOf } from '../utils/media'
import { prefetchVideo } from '../utils/videoCache'
import { safeRouteId } from '../utils/validators'

export default function Player() {
  const [params] = useSearchParams()
  const videoId = safeRouteId(params.get('v'))
  
  return <PlayerScreen videoId={videoId} />
}

/** Live "you can record again in Ns" countdown from a fixed past timestamp. Returns 0 once it has elapsed. */
function useCooldown(lastAt, cooldownMs) {
  const [now, setNow] = useState(null)

  useEffect(() => {
    if (!lastAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [lastAt, cooldownMs])

  return lastAt ? Math.max(0, cooldownMs - ((now ?? lastAt) - lastAt)) : 0
}

function PlayerScreen({ videoId }) {
  const { 
    publishedVideos, 
    categories, 
    videosIn, 
    submissionCount, 
    lastSubmissionAt, 
    nextVideo, 
    cooldownMs, 
    refresh 
  } = useLibrary()

  const uploads = useUploadQueue()
  const navigate = useNavigate()
  const location = useLocation()
  const baseRef = useRef(null)
  const video = publishedVideos.find((item) => item.id === videoId)
  // The video downloads once and stays in the browser for 5 minutes; the next one is fetched while this one plays.
  const cached = useCachedVideo(video)
  const upNext = video ? nextVideo(video) : null
  const cachedStatus = cached.status
  useEffect(() => {
    if (cachedStatus !== 'loading' && upNext) prefetchVideo(upNext)
  }, [cachedStatus, upNext])

  // The page layout follows the video's shape: tall phone videos get a narrow window and more room for the recorder.
  const [aspectMeasurement, setAspectMeasurement] = useState({ videoId, aspect: null })
  const measuredAspect = aspectMeasurement.videoId === videoId ? aspectMeasurement.aspect : null
  const [submissionNotice, setSubmissionNotice] = useState(() => ({ videoId, active: Boolean(location.state?.justSubmitted) }))
  const justSubmitted = submissionNotice.videoId === videoId && submissionNotice.active

  useEffect(() => {
    if (!justSubmitted) return undefined
    const timer = setTimeout(() => setSubmissionNotice({ videoId, active: false }), 5000)
    return () => clearTimeout(timer)
  }, [justSubmitted, videoId])

  const remaining = useCooldown(video ? lastSubmissionAt(video.id) : null, cooldownMs)
  // The countdown only ever counts down, so a fresh 0 -> refresh library data to reflect the new submission in badges/counts.
  const wasCoolingDown = useRef({ videoId, active: false })

  useEffect(() => {
    if (wasCoolingDown.current.videoId !== videoId) {
      wasCoolingDown.current = { videoId, active: false }
      return
    }
    if (remaining > 0) {
      wasCoolingDown.current.active = true
    } else if (wasCoolingDown.current.active) {
      wasCoolingDown.current.active = false
      refresh() 
    }
  }, [remaining, refresh, videoId])

  if (!video) {
    return (
      <PageState 
        eyebrow="Not found" 
        title="That video isn't available." 
        action={<ButtonLink to={paths.library}>Back to library</ButtonLink>}
      >
        It may have been unpublished or removed.
      </PageState>
    )
  }

  const aspect = measuredAspect ?? aspectOf(video)
  const category = categories.find((item) => item.id === video.categoryId)
  const number = videosIn(video.categoryId).findIndex((item) => item.id === video.id) + 1
  const count = submissionCount(video.id)
  const next = nextVideo(video)
  const goNext = () => navigate(next ? watchUrl(next.id) : categoryUrl(video.categoryId))
  const seconds = Math.ceil(remaining / 1000)

  return (
    <main className="page">
      <div className="shell player-top">
        <Link to={categoryUrl(video.categoryId)}>← Back to videos</Link>
        <span>Video {String(number).padStart(2, '0')}</span>
      </div>

      <section className="shell player-grid" data-orientation={aspect ? orientationOf(aspect) : 'landscape'}>
        <div>
          <BasePlayer video={video} videoRef={baseRef} onAspect={(aspect) => setAspectMeasurement({ videoId, aspect })} src={cached.src} loading={cached.status === 'loading'} progress={cached.progress} />
          
          <div className="player-meta">
            <div>
              <Eyebrow>{category?.label}</Eyebrow>
              <h1 className="display display-lg">{video.title}</h1>
            </div>
            <Button variant="outline" onClick={goNext}>
              {next ? 'Next video →' : 'Back to videos'}
            </Button>
          </div>

          {justSubmitted && (
            <Alert tone="success">
              Recording queued — it uploads in the background, so you can pick your next video now.
            </Alert>
          )}
        </div>

        <aside className="player-side">
          {uploads.itemFor(video.id) ? (
            <div className="cooldown">
              <p className="recorder-status is-live"><span aria-hidden="true">●</span> {uploads.itemFor(video.id).status === 'failed' ? 'Upload failed' : uploads.itemFor(video.id).status === 'uploading' ? `Uploading ${Math.round(uploads.itemFor(video.id).progress * 100)}%` : 'Waiting to upload'}</p>
              <h2 className="display display-md">
                Your recording<br /><em>is on its way.</em>
              </h2>
              <p className="recorder-copy">
                You don't have to wait. Watch and record other videos while this one uploads; details are in the corner of the screen.
              </p>
              <Button block onClick={goNext}>
                {next ? 'Next video' : 'Back to videos'} →
              </Button>
            </div>
          ) : remaining > 0 ? (
            <div className="cooldown">
              <p className="recorder-status">
                <span aria-hidden="true">✓</span> {count > 1 ? `Recorded ${count} times` : 'Recorded'}
              </p>
              <h2 className="display display-md">
                Nice work.<br /><em>Rest a moment.</em>
              </h2>
              <p className="recorder-copy">
                To keep every take a genuine, separate recording, you can record this video again in <b>{seconds}s</b>.
              </p>

              <div 
                className="cooldown-ring" 
                role="status" 
                aria-label={`${seconds} seconds until you can record again`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" className="cooldown-track" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="44" 
                    className="cooldown-progress" 
                    style={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - remaining / cooldownMs) }} 
                  />
                </svg>
                <span>{seconds}</span>
              </div>

              <Button block onClick={goNext}>
                {next ? 'Next video' : 'Back to videos'} →
              </Button>
            </div>
          ) : (
            <RecorderPanel 
              key={video.id}
              video={video} 
              baseRef={baseRef} 
              aspect={aspect}
              onSaveAndEdit={() => navigate(watchEditUrl(video.id))} 
            />
          )}
        </aside>
      </section>
    </main>
  )
}
