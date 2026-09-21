import { useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BasePlayer from '../components/BasePlayer'
import RecorderPanel from '../components/RecorderPanel'
import { Button, ButtonLink, Eyebrow, PageState } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'

export default function Player() {
  const { videoId } = useParams()
  // Keyed so switching lessons resets the player and the camera.
  return <PlayerScreen key={videoId} videoId={videoId} />
}

function PlayerScreen({ videoId }) {
  const { publishedVideos, categories, videosIn, isDone, nextVideo } = useLibrary()
  const navigate = useNavigate()
  const baseRef = useRef(null)
  const video = publishedVideos.find((item) => item.id === videoId)

  if (!video) {
    return <PageState eyebrow="Not found" title="That lesson isn't available." action={<ButtonLink to="/home">Back to library</ButtonLink>}>It may have been unpublished or removed.</PageState>
  }

  const category = categories.find((item) => item.id === video.categoryId)
  const number = videosIn(video.categoryId).findIndex((item) => item.id === video.id) + 1
  const done = isDone(video.id)
  const next = nextVideo(video)
  const goNext = () => navigate(next ? `/lesson/${next.id}` : `/library/${video.categoryId}`)

  return <main className="page">
    <div className="shell player-top"><Link to={`/library/${video.categoryId}`}>← Back to lessons</Link><span>{video.level} · Lesson {String(number).padStart(2, '0')}</span></div>
    <section className="shell player-grid">
      <div>
        <BasePlayer video={video} videoRef={baseRef} />
        <div className="player-meta">
          <div><Eyebrow>{category?.label}</Eyebrow><h1 className="display display-lg">{video.title}</h1></div>
          <Button variant="outline" onClick={goNext}>{next ? 'Next video →' : 'Back to lessons'}</Button>
        </div>
      </div>
      <aside className="player-side">
        {done
          ? <div className="locked">
            <p className="recorder-status"><span aria-hidden="true">✓</span> Submitted</p>
            <h2 className="display display-md">Lesson<br /><em>complete.</em></h2>
            <p className="recorder-copy">Your recording was submitted, so it is locked. Submitted recordings can't be watched, edited or deleted.</p>
            <Button block onClick={goNext}>{next ? 'Next video' : 'Back to lessons'} →</Button>
            <ButtonLink variant="outline" block to="/profile" className="locked-secondary">View my progress</ButtonLink>
          </div>
          : <RecorderPanel video={video} baseRef={baseRef} onSaveAndEdit={() => navigate(`/lesson/${video.id}/edit`)} />}
      </aside>
    </section>
  </main>
}
