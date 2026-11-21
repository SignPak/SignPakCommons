import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Button, ButtonLink } from '../components/ui'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'
import { safeRouteId } from '../utils/validators'

export const RESEND_WAIT_SECONDS = 60
const CODE = /^\d{6}$/

/**
 * D4: confirms a signed-out recording/data deletion request with the six-digit code emailed to
 * the account. The page never says whether an account exists: the copy covers both cases.
 */
export default function ContactVerify() {
  const [params] = useSearchParams()
  const id = safeRouteId(params.get('id'))
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [resending, setResending] = useState(false)
  // The first code went out when the request was sent, so the wait starts at once.
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS)

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (!id) {
    return <AuthShell eyebrow="Deletion request" title="This link is not valid." subtitle="Open the link from the contact form again, or send a new request.">
      <ButtonLink to={paths.contact} block>Back to the contact form</ButtonLink>
    </AuthShell>
  }

  if (verified) {
    return <AuthShell eyebrow="Deletion request" title="Request verified." subtitle="Thank you. The team will handle your request and reply by email.">
      <ButtonLink to={paths.home} block>Back to the home page</ButtonLink>
    </AuthShell>
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!CODE.test(code)) {
      setCodeError('Enter the six-digit code from your email.')
      return
    }
    setCodeError('')
    setVerifying(true)
    try {
      await api.contact.verify(id, code)
      setVerified(true)
    } catch (cause) {
      if (cause.fields?.code) setCodeError(cause.fields.code)
      else setError(cause.message || 'We could not check that code. Try again.')
    } finally {
      setVerifying(false)
    }
  }

  const resend = async () => {
    setError('')
    setNotice('')
    setResending(true)
    try {
      const response = await api.contact.resend(id)
      setNotice(response?.message || 'If an account uses this email, a new code is on its way.')
      setWait(RESEND_WAIT_SECONDS)
    } catch (cause) {
      setError(cause.message || 'A new code could not be sent.')
      if (cause.status === 429) setWait(RESEND_WAIT_SECONDS)
    } finally {
      setResending(false)
    }
  }

  return <AuthShell
    eyebrow="Deletion request"
    title="Confirm your request."
    subtitle="If an account uses the email you gave, we have sent a six-digit code to it. Enter it here to confirm the request is yours."
    footer={<>No account any more? You don&apos;t need a code: the team will check your request by hand and may email you for more information.</>}
  >
    <form onSubmit={submit} noValidate>
      <Field
        label="Six-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
        error={codeError}
      />
      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={verifying}>{verifying ? 'Checking…' : 'Confirm request'}</Button>
    </form>
    <Button variant="outline" block onClick={resend} disabled={verifying || resending || wait > 0}>
      {resending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
    </Button>
  </AuthShell>
}
