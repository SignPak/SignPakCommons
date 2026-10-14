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
    a: 'Yes, and it helps: more varied recordings of the same sign make the resulting dataset stronger. Once an upload is accepted, there is a 30-second pause before you can submit another recording for that same video, mainly to make sure each take is a genuine, separate recording rather than a rapid re-upload of the same clip.',
  },
  {
    q: 'Can I watch, edit or delete a recording after I submit it?',
    a: 'No. Once a recording is submitted it is locked: you cannot play it back, edit it or remove it yourself. To request deletion of the stored recording and related contribution data, use the home page contact form and choose “Request recording/data deletion”. You can send a request at any time, before or after deleting your account. Recordings already used in a released model cannot be removed from that model.',
  },
  {
    q: 'What happens to my recordings if I delete my account?',
    a: 'Deleting your account removes your account and sign-in access, but submitted recordings and related contribution data remain stored; deleting your account does not delete them. You can request deletion separately through the “Request recording/data deletion” contact topic at any time, before or after account deletion. Include the email used for your account so the team can identify your request. If you contact us after deleting your account, we may ask for additional information to verify and match your former recordings. Recordings already used in a released model cannot be removed from that released model.',
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
    a: 'Reach out through the contact form on the home page, or email the team directly. We read every message. You can submit recording/data deletion requests through the dedicated contact topic even after your account has been deleted.',
  },
]

export default function Faq() {
  useSeo('/faq')
  const { user } = useAuth()
  return <main>
    <section className="shell faq-head">
      <Eyebrow>Questions, answered</Eyebrow>
      <h1 className="display display-xl">Frequently asked<br /><em>questions.</em></h1>
      <p className="lede">Everything you need to know about contributing videos to Signpak Commons. Still stuck? <Link className="link-accent" to={paths.contact}>Contact us</Link> or head back to the <Link className="link-accent" to={paths.home}>home page</Link>.</p>
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
