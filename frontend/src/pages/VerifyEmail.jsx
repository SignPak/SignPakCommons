import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'
import { verifyEmailSchema } from '../utils/authSchemas'
import { applyAuthFieldErrors } from '../utils/authFormErrors'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const [error, setError] = useState('')
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState(location.state?.emailSent === false
    ? 'We could not send the code yet. Try sending a new code.'
    : params.get('email') ? 'Enter the six-digit code sent to your email.' : '')
  const { register, handleSubmit, getValues, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: params.get('email') || '', code: '' },
  })

  const submit = async ({ email, code }) => {
    setError('')
    try {
      const { consentToken } = await verifyEmail(email, code)
      navigate(paths.signupConsent, { replace: true, state: { consentToken } })
    } catch (cause) {
      if (!applyAuthFieldErrors(cause, setFieldError)) setError(cause.message || 'We could not verify that code.')
    }
  }

  const resend = async () => {
    setError('')
    setResending(true)
    try {
      const response = await api.auth.resendVerification(getValues('email'))
      setNotice(response.message)
    } catch (cause) {
      if (!applyAuthFieldErrors(cause, setFieldError)) setError(cause.message || 'A new code could not be sent.')
    } finally {
      setResending(false)
    }
  }

  return <AuthShell
    eyebrow="Email verification"
    title="Check your inbox."
    subtitle="Verify your email address to activate your account."
    footer={<>Already verified? <Link to={paths.login}>Log in</Link></>}
  >
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Field label="Email address" type="email" {...register('email')} error={errors.email?.message} autoComplete="email" />
      <Field
        label="Six-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        {...register('code', { setValueAs: (value) => value.replace(/\D/g, '').slice(0, 6) })}
        error={errors.code?.message}
      />
      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block disabled={isSubmitting}>{isSubmitting ? 'Verifying…' : 'Verify email'}</Button>
    </form>
    <Button variant="outline" block onClick={resend} disabled={isSubmitting || resending}>{resending ? 'Sending…' : 'Send a new code'}</Button>
  </AuthShell>
}
