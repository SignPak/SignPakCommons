import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../context/LibraryContext'
import Field from '../components/Field'
import Footer from '../components/Footer'
import { Alert, Arrow, Button, ButtonLink, Eyebrow } from '../components/ui'
import { LOREM_LONG, LOREM_MEDIUM, LOREM_SHORT, policyItems } from '../mock/lorem'
import { api } from '../services/api'

export default function Landing() {
  const { user } = useAuth()
  const { publishedVideos, categories } = useLibrary()

  return <main>
    <section className="hero feature">
      <div className="shell hero-inner">
        <div>
          <Eyebrow>A new way to learn together ✦</Eyebrow>
          <h1 className="display display-xl">Find your<br /><em>sign.</em></h1>
          <p className="hero-copy">{LOREM_SHORT}</p>
          <div className="hero-actions">
            <ButtonLink variant="outline" to="/demo">See how it works</ButtonLink>
            <ButtonLink to={user ? '/home' : '/signup'}>{user ? 'Open library' : 'Get started'} <Arrow /></ButtonLink>
          </div>
          <p className="hero-proof">Lorem ipsum dolor sit amet, consectetur.</p>
        </div>
        <div className="hero-art">
          <div className="hero-photo" role="img" aria-label="People collaborating around a table" />
          <blockquote className="hero-quote">“Lorem ipsum dolor<br />sit amet.”<small>Consectetur adipiscing</small></blockquote>
        </div>
      </div>
    </section>

    <div className="marquee" aria-hidden="true">LOREM IPSUM &nbsp; ✦ &nbsp; DOLOR SIT AMET &nbsp; ✦ &nbsp; CONSECTETUR ADIPISCING</div>

    <section id="about" className="shell landing-section landing-about">
      <div><Eyebrow>About us</Eyebrow><h2 className="display display-lg">Practice with<br /><em>purpose.</em></h2></div>
      <div className="about-body">
        <p>{LOREM_LONG}</p>
        <p>{LOREM_MEDIUM}</p>
        <dl className="stats">
          <div><dt>lessons</dt><dd>{publishedVideos.length}</dd></div>
          <div><dt>learning paths</dt><dd>{categories.length}</dd></div>
          <div><dt>ways to grow</dt><dd>∞</dd></div>
        </dl>
      </div>
    </section>

    <section id="policy" className="landing-band">
      <div className="shell landing-section">
        <Eyebrow>Policy</Eyebrow>
        <h2 className="display display-lg">Lorem ipsum <em>dolor sit.</em></h2>
        <div className="policy-grid">
          {policyItems.map((item) => <article key={item.id} className="policy-card"><h3 className="display display-sm">{item.title}</h3><p>{item.body}</p></article>)}
        </div>
      </div>
    </section>

    <section id="contact" className="shell landing-section contact">
      <div>
        <Eyebrow>Contact us</Eyebrow>
        <h2 className="display display-lg">Let us<br /><em>talk.</em></h2>
        <p className="contact-copy">{LOREM_MEDIUM}</p>
        <a className="link-accent" href="mailto:hello@signpak.example">hello@signpak.example</a>
      </div>
      <ContactForm />
    </section>

    <section className="cta-band feature">
      <div className="cta-band-copy"><Eyebrow light>Your next chapter</Eyebrow><h2 className="display display-lg">Ready to make<br /><em>some space?</em></h2><ButtonLink variant="light" to={user ? '/home' : '/signup'}>{user ? 'Open library' : 'Create your account'} <Arrow /></ButtonLink></div>
      <div className="cta-band-art" role="img" aria-label="Hands signing" />
    </section>
    <Footer />
  </main>
}

function ContactForm() {
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    try {
      await api.contact.send(values)
      setValues({ name: '', email: '', message: '' })
      setStatus('sent')
    } catch { setStatus('error') }
  }

  if (status === 'sent') {
    return <div className="contact-card contact-done">
      <span className="contact-check" aria-hidden="true">✓</span>
      <h3 className="display display-md">Message received.</h3>
      <p>Lorem ipsum dolor sit amet, we will be in touch soon.</p>
      <Button variant="ghost" onClick={() => setStatus('idle')}>Send another message</Button>
    </div>
  }
  return <form className="contact-card" onSubmit={submit}>
    <Field label="Your name" name="name" value={values.name} onChange={change} placeholder="Maya Rivera" required autoComplete="name" />
    <Field label="Email address" name="email" type="email" value={values.email} onChange={change} placeholder="you@example.com" required autoComplete="email" />
    <Field as="textarea" label="Your message" name="message" value={values.message} onChange={change} placeholder="Lorem ipsum dolor sit amet…" rows={5} required />
    {status === 'error' && <Alert tone="error">Your message could not be sent. Try again.</Alert>}
    <Button type="submit" block disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send message'} <Arrow /></Button>
  </form>
}
