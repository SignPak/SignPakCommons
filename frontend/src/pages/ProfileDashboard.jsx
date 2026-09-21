import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import { Alert, Arrow, Avatar, Badge, Button, ButtonLink, Eyebrow, ProgressBar, SectionHeading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../context/LibraryContext'
import { formatDate } from '../utils/format'
import { normalizeGithub, normalizeLinkedin } from '../utils/validators'

export default function ProfileDashboard() {
  const { user, isAdmin, logout } = useAuth()
  const { categories, videosIn, isDone, mySubmissions, publishedVideos, orderedPublished, doneCount } = useLibrary()
  const navigate = useNavigate()
  const total = orderedPublished.length
  const percent = total ? Math.round((doneCount / total) * 100) : 0
  const recent = [...mySubmissions].filter((item) => publishedVideos.some((video) => video.id === item.videoId)).sort((a, b) => b.submittedAt - a.submittedAt)

  return <main className="page">
    <section className="shell profile-head">
      <div>
        <Eyebrow>Your space</Eyebrow>
        <h1 className="display display-xl">{user.firstName} <em>{user.surname}.</em></h1>
        <p className="lede">{user.email} · Learning since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <Button variant="ghost" className="profile-logout" onClick={async () => { await logout(); navigate('/') }}>Log out</Button>
      </div>
      <Avatar user={user} size="lg" />
    </section>

    <section className="shell profile-grid">
      <div className="profile-main">
        <div className="panel">
          <SectionHeading eyebrow="Your progress" title="Keep going." action={<b className="profile-count">{doneCount}/{total}</b>} />
          <ProgressBar value={percent} label="Lessons complete" />
          <div className="progress-caption"><span>Lessons complete</span><b>{percent}%</b></div>
          <ul className="path-progress">
            {categories.filter((category) => videosIn(category.id).length).map((category) => {
              const lessons = videosIn(category.id)
              const done = lessons.filter((lesson) => isDone(lesson.id)).length
              return <li key={category.id}><span>{category.label}</span><ProgressBar value={(done / lessons.length) * 100} label={`${category.label} progress`} /><small>{done}/{lessons.length}</small></li>
            })}
          </ul>
          <ButtonLink variant="outline" to="/home" className="panel-action">Continue learning <Arrow /></ButtonLink>
        </div>

        <div className="panel">
          <Eyebrow>Your recordings</Eyebrow>
          <h2 className="display display-md">Recent work.</h2>
          {recent.length
            ? <ul className="submission-list">
              {recent.map((item) => {
                const video = publishedVideos.find((entry) => entry.id === item.videoId)
                return <li key={item.id}><span className="submission-icon" aria-hidden="true">✓</span><div><b>{video.title}</b><small>Submitted {formatDate(item.submittedAt)}</small></div><Badge tone="success">Done</Badge></li>
              })}
            </ul>
            : <p className="empty-note">Your submitted recordings will show up here, marked as done.</p>}
        </div>
      </div>

      <aside className="profile-side">
        <ConnectForm />
        {isAdmin && <div className="panel panel-outline">
          <Eyebrow>Workspace</Eyebrow>
          <h2 className="display display-sm">For the team.</h2>
          <p className="panel-copy">Manage base videos, categories and see how learners are doing.</p>
          <ButtonLink to="/admin" variant="outline" className="panel-action">Open admin workspace <Arrow /></ButtonLink>
        </div>}
      </aside>
    </section>
  </main>
}

function ConnectForm() {
  const { user, saveConnections } = useAuth()
  const [values, setValues] = useState({ github: user.connections?.github || '', linkedin: user.connections?.linkedin || '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')

  const change = (event) => { setMessage(''); setValues((current) => ({ ...current, [event.target.name]: event.target.value })) }
  const persist = async (github, linkedin, success) => {
    await saveConnections({ github, linkedin })
    setValues({ github: github || '', linkedin: linkedin || '' })
    setMessage(success)
  }
  const submit = async (event) => {
    event.preventDefault()
    const github = normalizeGithub(values.github)
    const linkedin = normalizeLinkedin(values.linkedin)
    const found = { ...(github.error && { github: github.error }), ...(linkedin.error && { linkedin: linkedin.error }) }
    setErrors(found)
    if (Object.keys(found).length) return
    await persist(github.value, linkedin.value, 'Your connections are saved.')
  }
  const disconnect = (name) => {
    setErrors({})
    const next = { github: user.connections?.github || null, linkedin: user.connections?.linkedin || null, [name]: null }
    return persist(next.github, next.linkedin, `${name === 'github' ? 'GitHub' : 'LinkedIn'} disconnected.`)
  }

  return <form className="panel panel-sage" onSubmit={submit} noValidate>
    <Eyebrow>Connect</Eyebrow>
    <h2 className="display display-md">Bring your<br /><em>world in.</em></h2>
    <Field label="GitHub" name="github" value={values.github} onChange={change} error={errors.github} placeholder="username or github.com/username" autoComplete="off" />
    {user.connections?.github && <p className="connected">✓ Connected as <a href={`https://github.com/${user.connections.github}`} target="_blank" rel="noreferrer">@{user.connections.github}</a> <button type="button" onClick={() => disconnect('github')}>Disconnect</button></p>}
    <Field label="LinkedIn" name="linkedin" value={values.linkedin} onChange={change} error={errors.linkedin} placeholder="linkedin.com/in/your-name" autoComplete="off" />
    {user.connections?.linkedin && <p className="connected">✓ Connected: <a href={user.connections.linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a> <button type="button" onClick={() => disconnect('linkedin')}>Disconnect</button></p>}
    {message && <Alert tone="success">{message}</Alert>}
    <Button type="submit" block className="panel-action">Save connections <Arrow /></Button>
  </form>
}
