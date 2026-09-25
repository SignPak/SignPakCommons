import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'
import { Arrow, ButtonLink, Eyebrow } from '../components/ui'
import { paths } from '../routes/appRoutes'
import { useSeo } from '../seo/seoUtils'

const faqs = [
  {
    q: 'What is Signpak Commons?',
    a: 'Signpak Commons is an open-source video collection tool. Contributors watch a short reference clip of a Pakistan Sign Language (PSL) word or phrase, then record themselves signing it. Those recordings become training data for an open PSL recognition model.',
  },
  {
    q: 'Is this a course? Do I need to "finish" anything?',
    a: 'No. There is no curriculum, no grading and nothing to complete. Categories group videos by topic so they are easier to browse, not because there is a required order. You can contribute to as many or as few videos as you like, in any order.',
  },
  {
    q: 'Can I record the same video more than once?',
    a: 'Yes, and it helps: more varied recordings of the same sign make the resulting dataset stronger. After you submit a recording there is a short 30-second pause before you can submit another one for that same video, mainly to make sure each take is a genuine, separate recording rather than a rapid re-upload of the same clip.',
  },
  {
    q: 'Can I watch, edit or delete a recording after I submit it?',
    a: 'No. Once a recording is submitted it is locked: you cannot play it back, edit it or remove it from your account. You can always record that same video again after the cooldown, and your new take is saved separately.',
  },
  {
    q: 'What happens to my recordings?',
    a: 'Recordings are used only to train and evaluate the PSL recognition model. They are not sold, shared with advertisers or used for anything outside this project.',
  },
  {
    q: 'Who can see my submissions?',
    a: 'Only project admins can review submitted recordings, and only to check recording quality. Other contributors cannot see or watch your recordings, and your profile only shows your own history.',
  },
  {
    q: 'What do I need to record a video?',
    a: 'A browser that supports camera access and MediaRecorder — recent Chrome, Edge, Firefox or Safari all work — a working camera, and reasonable lighting so your hands and upper body are clearly visible.',
  },
  {
    q: 'Can I trim my recording before submitting it?',
    a: 'Yes. After recording, the editor lets you drag two handles to keep only the part you want, mirror the video if that matches how you sign, and preview the trimmed range before you submit.',
  },
  {
    q: 'Who is behind this project?',
    a: 'Signpak Commons is a student-led, open-source initiative building toward an accuracy PSL recognition model that goes beyond isolated letters to everyday phrases and gestures. The code is open source and non-commercial.',
  },
  {
    q: 'I found a bug or have a question that is not answered here.',
    a: 'Reach out through the contact form on the home page, or email the team directly. We read every message.',
  },
]

export default function Faq() {
  useSeo('/faq')
  const { user } = useAuth()
  return <main>
    <section className="shell faq-head">
      <Eyebrow>Questions, answered</Eyebrow>
      <h1 className="display display-xl">Frequently asked<br /><em>questions.</em></h1>
      <p className="lede">Everything you need to know about contributing videos to Signpak Commons. Still stuck? <a className="link-accent" href="/#contact">Contact us</a> or head back to the <Link className="link-accent" to={paths.home}>home page</Link>.</p>
    </section>

    <section className="shell faq-body">
      <div className="faq-list">
        {faqs.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>{item.q}<span className="faq-item-icon" aria-hidden="true">+</span></summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <div className="faq-cta">
        <p>Ready to contribute your first video?</p>
        <ButtonLink to={user ? paths.library : paths.signup}>{user ? 'Open library' : 'Get started'} <Arrow /></ButtonLink>
      </div>
    </section>

    <Footer />
  </main>
}
