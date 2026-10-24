import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthShell from '../components/AuthShell'
import Field from '../components/Field'
import { Alert, Button } from '../components/ui'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'
import { emailOnlySchema, resetPasswordSchema } from '../utils/authSchemas'
import { applyAuthFieldErrors } from '../utils/authFormErrors'

export default function ForgotPassword() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resending, setResending] = useState(false)
  const resetting = params.get('step') === 'reset'
  const requestForm = useForm({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: params.get('email') || '' },
  })
  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: params.get('email') || '', code: '', password: '', confirmPassword: '' },
  })

  const requestCode = async ({ email }) => {
    setError('')
    try {
      const result = await api.auth.forgotPassword(email)
      setNotice(result.message)
      resetForm.setValue('email', email)
      setParams({ email, step: 'reset' }, { replace: true })
    } catch (cause) {
      if (!applyAuthFieldErrors(cause, requestForm.setError)) setError(cause.message || 'A reset code could not be requested.')
    }
  }

  const reset = async (values) => {
    setError('')
    try {
      await api.auth.resetPassword(values)
      navigate(paths.login, { replace: true, state: { notice: 'Password reset. Log in with your new password.' } })
    } catch (cause) {
      if (!applyAuthFieldErrors(cause, resetForm.setError)) setError(cause.message || 'Your password could not be reset.')
    }
  }

  const resend = async () => {
    setError('')
    setResending(true)
    try {
      const result = await api.auth.forgotPassword(resetForm.getValues('email'))
      setNotice(result.message)
    } catch (cause) {
      if (!applyAuthFieldErrors(cause, resetForm.setError)) setError(cause.message || 'A reset code could not be requested.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={resetting ? 'Choose a new password.' : 'Reset your password.'}
      subtitle={resetting ? 'Enter the code from your email and choose a new password.' : 'We’ll email a one-time code if an account matches.'}
      footer={<>Remembered it? <Link to={paths.login}>Log in</Link></>}
    >
      {!resetting ? (
        <form onSubmit={requestForm.handleSubmit(requestCode)} noValidate>
          <Field 
            label="Email address" 
            type="email" 
            {...requestForm.register('email')}
            error={requestForm.formState.errors.email?.message}
            autoComplete="email" 
          />
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" block disabled={requestForm.formState.isSubmitting}>
            {requestForm.formState.isSubmitting ? 'Requesting code…' : 'Send reset code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetForm.handleSubmit(reset)} noValidate>
          <Field 
            label="Email address" 
            type="email" 
            {...resetForm.register('email')}
            error={resetForm.formState.errors.email?.message}
            autoComplete="email" 
          />
          <Field 
            label="Six-digit code" 
            inputMode="numeric" 
            autoComplete="one-time-code" 
            {...resetForm.register('code', { setValueAs: (value) => value.replace(/\D/g, '').slice(0, 6) })}
            error={resetForm.formState.errors.code?.message}
          />
          <Field 
            label="New password" 
            type="password" 
            autoComplete="new-password" 
            {...resetForm.register('password')}
            error={resetForm.formState.errors.password?.message}
            hint="Use at least 8 characters." 
          />
          <Field 
            label="Confirm new password" 
            type="password" 
            autoComplete="new-password" 
            {...resetForm.register('confirmPassword')}
            error={resetForm.formState.errors.confirmPassword?.message}
          />
          {notice && <Alert tone="info">{notice}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" block disabled={resetForm.formState.isSubmitting}>
            {resetForm.formState.isSubmitting ? 'Saving password…' : 'Reset password'}
          </Button>
          <Button variant="outline" block onClick={resend} disabled={resetForm.formState.isSubmitting || resending}>
            {resending ? 'Sending…' : 'Send another code'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
