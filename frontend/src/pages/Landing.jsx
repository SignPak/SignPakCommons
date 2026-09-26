import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../context/LibraryContext'
import Field from '../components/Field'
import Footer from '../components/Footer'
import { Alert, Arrow, Button, ButtonLink, Eyebrow } from '../components/ui'
import { api } from '../services/api'
import { paths } from '../routes/appRoutes'

// Guidelines & Policy items for PSL dataset collection
const policyItems = [
  {
    id: 1,
    title: "Post-Training Deletion",
    body: "Your raw video uploads are used solely to extract motion and gesture data. Once our AI model training is complete, all original video files are permanently deleted from our servers."
  },
  {
    id: 2,
    title: "100% Open-Source & Non-Commercial",
    body: "This is a student-led non-profit initiative. We will never sell, monetize, or share your recorded videos with third-party advertisers or private entities."
  },
  {
    id: 3,
    title: "Open-Source Disclaimer",
    body: "We implement standard security measures to protect your data. However, as a university research project, we cannot assume full legal liability in the unlikely event of a server breach."
  }
]

const contributorPerks = [
  {
    id: 1,
    title: "Connect Profiles",
    body: "Link your GitHub or LinkedIn profile to track your contributions and verify your impact."
  },
  {
    id: 2,
    title: "Project Accomplishments",
    body: "Reach the upload milestone threshold to get publicly credited in our open-source repo and website hall of fame."
  },
  {
    id: 3,
    title: "Certificate of Appreciation",
    body: "We will provide a certificate of contribution for your role in advancing PSL accessibility."
  }
]

export default function Landing() {
  const { user } = useAuth()
  const { publishedVideos, categories } = useLibrary()

  return (
    <main>
      {/* HERO SECTION */}
      <section className="hero feature">
        <div className="shell hero-inner">
          <div>
            <Eyebrow>Empowering Pakistan Sign Language Through AI ✦</Eyebrow>
            <h1 className="display display-xl">
              Contribute for a<br />
              <em>purpose.</em>
            </h1>
            <p className="hero-copy">
              Help us build the first open-source model for PSL. Your video contributions make communication accessible for millions across Pakistan.
            </p>
            <div className="hero-actions">
              <ButtonLink variant="outline" to={paths.demo}>
                See how to contribute
              </ButtonLink>
              <ButtonLink to={user ? paths.library : paths.signup}>
                {user ? 'Open library' : 'Get started'} <Arrow />
              </ButtonLink>
            </div>
            <p className="hero-proof">
              Join us to make a difference.
            </p>
          </div>
          <div className="hero-art">
            <div className="hero-photo" role="img" aria-label="Community members collaborating on sign language" />
            <blockquote className="hero-quote">
              “Every sign contributed brings the distance to an end.”
              <small>signpak</small>
            </blockquote>
          </div>
        </div>
      </section>

      {/* MARQUEE BAND */}
      <div className="marquee" aria-hidden="true">
        RECORD SIGNS &nbsp; ✦ &nbsp; TRAIN AI &nbsp; ✦ &nbsp; HELP COMMUNITY &nbsp; ✦ &nbsp; 
      </div>

      {/* ABOUT SECTION */}
      <section id="about" className="shell landing-section landing-about">
        <div>
          <Eyebrow>About us</Eyebrow>
          <h2 className="display display-lg">
            Building AI for<br />
            <em>inclusion.</em>
          </h2>
        </div>
        <div className="about-body">
          <p>
            Developed as a Final Year Project by Software Engineering students at the National University of Sciences & Technology (NUST), this initiative addresses a crucial gap in accessibility. While existing Pakistan Sign Language (PSL) models are mostly restricted to basic alphabets, our goal is to build a high-accuracy recognition model for complete everyday phrases and gestures.
          </p>
          <p>
            By contributing short video clips of signs, you directly help train and fine-tune machine learning models, moving PSL technology beyond isolated letters toward real-world communication.
          </p>
          <dl className="stats">
            <div>
              <dt>signs cataloged</dt>
              <dd>{publishedVideos.length}</dd>
            </div>
            <div>
              <dt>categories</dt>
              <dd>{categories.length}</dd>
            </div>
            <div>
              <dt>community impact</dt>
              <dd>∞</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* RECOGNITION & PERKS SECTION */}
      <section id="perks" className="shell landing-section">
        <div>
          <Eyebrow>Recognition</Eyebrow>
          <h2 className="display display-lg">
            Get credited for<br />
            <em>your impact.</em>
          </h2>
        </div>
        <div className="policy-grid">
          {contributorPerks.map((perk) => (
            <article key={perk.id} className="policy-card">
              <h3 className="display display-sm">{perk.title}</h3>
              <p>{perk.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* POLICY SECTION */}
      <section id="policy" className="landing-band">
        <div className="shell landing-section">
          <Eyebrow>Policy & Terms</Eyebrow>
          <h2 className="display display-lg">
            Data & privacy <em>guidelines.</em>
          </h2>
          <div className="policy-grid">
            {policyItems.map((item) => (
              <article key={item.id} className="policy-card">
                <h3 className="display display-sm">{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="cta-band feature">
        <div className="cta-band-copy">
          <Eyebrow light>Spend 2 minutes. Break a barrier.</Eyebrow>
          <h2 className="display display-lg">
            Ready to contribute<br />
            <em>your signs?</em>
          </h2>
          <ButtonLink variant="light" to={user ? paths.library : paths.signup}>
            {user ? 'Open library' : 'Create your account'} <Arrow />
          </ButtonLink>
        </div>
        <div className="cta-band-art" role="img" aria-label="Hands signing PSL" />
      </section>
      
      {/* CONTACT SECTION */}
      <section id="contact" className="shell landing-section contact">
        <div>
          <Eyebrow>Contact us</Eyebrow>
          <h2 className="display display-lg">
            Let us<br />
            <em>talk.</em>
          </h2>
          <p className="contact-copy">
            Have questions about video contributions, recording specifications, or partnership opportunities? Reach out to our team.
          </p>
          {/* <a className="link-accent" href="mailto:contact@pslai.org">
            contact@pslai.org
          </a> */}
        </div>
        <ContactForm key={user?.id || 'guest'} />
      </section>

      {/* FOOTER */}
      <Footer />
    </main>
  )
}

function ContactForm() {
  const { user } = useAuth()
  const [values, setValues] = useState(() => ({ name: user ? `${user.firstName} ${user.surname}` : '', email: user?.email || '', message: '' }))
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('')
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')
    try {
      await api.contact.send(values)
      setValues({ name: `${user.firstName} ${user.surname}`, email: user.email, message: '' })
      setStatus('sent')
    } catch (error) {
      setErrorMessage(error.message || 'Your message could not be sent. Try again.')
      setStatus('error')
    }
  }

  if (!user) {
    return <div className="contact-card">
      <h3 className="display display-md">Sign in to contact us.</h3>
      <p>Contact messages are limited to one per account each day. Sign in with a verified email address to send yours.</p>
      <ButtonLink to={paths.login}>Log in to continue <Arrow /></ButtonLink>
    </div>
  }

  if (status === 'sent') {
    return (
      <div className="contact-card contact-done">
        <span className="contact-check" aria-hidden="true">✓</span>
        <h3 className="display display-md">Message received.</h3>
        <p>Thank you for reaching out! We have received your message and will get back to you shortly.</p>
        <Button variant="ghost" onClick={() => setStatus('idle')}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form className="contact-card" onSubmit={submit}>
      <Field
        label="Your name"
        name="name"
        value={values.name}
        onChange={change}
        placeholder="e.g. Ali Ahmed"
        required
        autoComplete="name"
      />
      <Field
        label="Email address"
        name="email"
        type="email"
        value={values.email}
        readOnly
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Field
        as="textarea"
        label="Your message"
        name="message"
        value={values.message}
        onChange={change}
        placeholder="Ask a question, share feedback, or inquire about contributing datasets…"
        rows={5}
        required
      />
      {status === 'error' && <Alert tone="error">{errorMessage}</Alert>}
      <Button type="submit" block disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'} <Arrow />
      </Button>
    </form>
  )
}
