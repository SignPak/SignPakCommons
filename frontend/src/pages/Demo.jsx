import { useAuth } from '../context/AuthContext'
import { Arrow, ButtonLink, Eyebrow } from '../components/ui'
import { DEMO_VIDEO } from '../mock/data'
import { demoSteps } from '../mock/lorem'

export default function Demo() {
  const { user } = useAuth()
  return <main className="demo feature">
    <div className="shell demo-top">
      <ButtonLink variant="ghost" to="/">← Back home</ButtonLink>
      <ButtonLink to={user ? '/home' : '/signup'}>{user ? 'Open library' : 'Get started'} <Arrow /></ButtonLink>
    </div>
    <section className="shell demo-grid">
      <div>
        <Eyebrow>How Signpak works</Eyebrow>
        <h1 className="display display-xl">Watch.<br /><em>Record.</em><br />Share.</h1>
        <ol className="demo-steps">
          {demoSteps.map((step) => <li key={step.title}><b>{step.title}</b><span>{step.body}</span></li>)}
        </ol>
      </div>
      <figure className="demo-video">
        <video src={DEMO_VIDEO} controls playsInline preload="metadata" aria-label="Signpak walkthrough video" />
        <figcaption>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</figcaption>
      </figure>
    </section>
  </main>
}
