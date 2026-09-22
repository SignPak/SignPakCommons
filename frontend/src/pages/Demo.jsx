import { useAuth } from '../context/AuthContext'
import { Arrow, ButtonLink, Eyebrow } from '../components/ui'
import { DEMO_VIDEO } from '../mock/data'

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
  return (
    <main className="demo feature">
      <div className="shell demo-top">
        <ButtonLink variant="ghost" to="/">← Back home</ButtonLink>
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
          <video 
            src={DEMO_VIDEO} 
            controls 
            playsInline 
            preload="metadata" 
            aria-label="Pakistan Sign Language dataset contribution walkthrough video" 
          />
          <figcaption>
            A quick walkthrough on how to record, review, and upload your video samples to help build Pakistan's open PSL dataset.
          </figcaption>
        </figure>
      </section>
    </main>
  )
}
