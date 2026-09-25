import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Alert, Arrow, ButtonLink, Eyebrow } from '../components/ui'
import { api } from '../services/api'
import { paths } from '../routes/appRoutes'

const demoSteps = [
  {
    title: "1. Pick a Sign",
    body: "Browse the catalog to select a phrase or word that needs dataset samples. Review the reference demonstration video to learn the exact movement."
  },
  {
    title: "2. Record Your Gesture",
    body: "Position yourself in good lighting with your upper torso and hands clearly visible. Record yourself performing the sign at a natural, conversational speed."
  },
  {
    title: "3. Submit",
    body: "Upload your clip directly through the browser. "
  }
]

export default function Demo() {
  const { user } = useAuth()
  const [demoVideo, setDemoVideo] = useState(null)
  const [videoState, setVideoState] = useState('loading')

  useEffect(() => {
    let active = true
    api.videos.list()
      .then((videos) => {
        if (!active) return
        setDemoVideo(videos[0] || null)
        setVideoState(videos[0] ? 'ready' : 'empty')
      })
      .catch(() => {
        if (active) setVideoState('error')
      })
    return () => { active = false }
  }, [])

  return (
    <main className="demo feature">
      <div className="shell demo-top">
        <ButtonLink variant="ghost" to={paths.home}>← Back home</ButtonLink>
        <ButtonLink to={user ? '/home' : '/signup'}>
          {user ? 'Open library' : 'Get started'} <Arrow />
        </ButtonLink>
      </div>
      <section className="shell demo-grid">
        <div>
          <Eyebrow>How to contribute</Eyebrow>
          <h1 className="display display-xl">
            Watch.<br />
            Record.<br />
            <em>Contribute.</em>
          </h1>
          <ol className="demo-steps">
            {demoSteps.map((step) => (
              <li key={step.title}>
                <b>{step.title}</b>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        </div>
        <figure className="demo-video">
          {videoState === 'loading' && <p role="status">Loading a reference video...</p>}
          {videoState === 'error' && <Alert tone="error">Reference videos are temporarily unavailable.</Alert>}
          {videoState === 'empty' && <p role="status">No published reference videos are available yet.</p>}
          {demoVideo && <>
            <video
              src={demoVideo.videoUrl}
              poster={demoVideo.poster || undefined}
              controls
              playsInline
              preload="metadata"
              aria-label={`${demoVideo.title} reference video`}
            />
            <figcaption>{demoVideo.title} · A real reference clip from the current PSL dataset.</figcaption>
          </>}
        </figure>
      </section>
    </main>
  )
}
