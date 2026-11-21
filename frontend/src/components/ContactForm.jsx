import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Field from './Field'
import { Alert, Arrow, Button } from './ui'
import { api } from '../services/api'
import { contactVerifyUrl } from '../routes/appRoutes'

export const DELETION_TOPIC = 'recording-deletion'

const TOPICS = [
  { value: 'general', label: 'General inquiry', signedInOnly: true },
  { value: 'partnership', label: 'Partnership', signedInOnly: true },
  { value: DELETION_TOPIC, label: 'Request recording/data deletion', signedInOnly: false },
]

const FIELDS = ['topic', 'name', 'email', 'message']

/**
 * Landing-page contact form (FR13.13, C2). Signed-in contributors can send a general or
 * partnership message (one a day) or a deletion request; signed-out visitors can send only a
 * deletion request, which they then confirm with the code emailed to the account (D4).
 */
export default function ContactForm() {
  // Until the session is known the topics may be wrong, so sending waits for it.
  const { user, sessionChecked } = useAuth()
  const navigate = useNavigate()
  const topics = TOPICS.filter((topic) => user || !topic.signedInOnly)
  const [values, setValues] = useState(() => ({
    topic: topics[0].value,
    name: user ? `${user.firstName} ${user.surname}` : '',
    email: user?.email || '',
    message: '',
  }))
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const change = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setStatus('sending')
    setFormError('')
    setFieldErrors({})
    try {
      const receipt = await api.contact.send(values)
      if (receipt?.verificationRequired) {
        navigate(contactVerifyUrl(receipt.id))
        return
      }
      setStatus('sent')
    } catch (cause) {
      const fields = Object.fromEntries(Object.entries(cause.fields || {}).filter(([name]) => FIELDS.includes(name)))
      setFieldErrors(fields)
      // Field problems are shown next to their inputs; anything else (403, 409, 429, 5xx) here.
      if (!Object.keys(fields).length) setFormError(cause.message || 'We could not send your message. Try again later.')
      setStatus('idle')
    }
  }

  const reset = () => {
    setValues((current) => ({ ...current, message: '' }))
    setStatus('idle')
  }

  if (status === 'sent') {
    return (
      <div className="contact-card contact-done">
        <span className="contact-check" aria-hidden="true">✓</span>
        <h3 className="display display-md">Message received.</h3>
        <p>Thank you for reaching out! We have received your message and will get back to you shortly.</p>
        <Button variant="ghost" onClick={reset}>
          Send another message
        </Button>
      </div>
    )
  }

  const isDeletion = values.topic === DELETION_TOPIC
  return (
    <form className="contact-card" onSubmit={submit} noValidate>
      <Field
        as="select"
        label="Contact topic"
        name="topic"
        value={values.topic}
        onChange={change}
        error={fieldErrors.topic}
        hint={user ? undefined : 'Log in to send a general or partnership message.'}
      >
        {topics.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
      </Field>
      {isDeletion && (
        <p className="contact-note" data-testid="deletion-explainer">
          You can send this request before or after deleting your account, at any time. Use the email
          from your contributor account so the team can find your data.
          {user
            ? ' Because you are logged in, your request is confirmed straight away.'
            : ' We will email a six-digit code to that address to confirm the request is yours. If the account no longer exists, the team will check the request by hand and may ask for more information.'}
          {' '}Deleting your account alone does not delete your recordings. Recordings already used in a
          released model cannot be removed from that model.
        </p>
      )}
      <Field
        label="Your name"
        name="name"
        value={values.name}
        onChange={change}
        error={fieldErrors.name}
        placeholder="e.g. Ali Imran"
        required
        autoComplete="name"
      />
      <Field
        label="Email address"
        name="email"
        type="email"
        value={values.email}
        onChange={change}
        error={fieldErrors.email}
        readOnly={Boolean(user)}
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
        error={fieldErrors.message}
        placeholder={isDeletion
          ? 'Tell us which data you would like deleted.'
          : 'Ask a question, share feedback, or inquire about contributing datasets…'}
        rows={5}
        required
      />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" block disabled={status === 'sending' || !sessionChecked}>
        {status === 'sending' ? 'Sending…' : !sessionChecked ? 'Checking your session…' : isDeletion ? 'Send deletion request' : 'Send message'} <Arrow />
      </Button>
    </form>
  )
}
