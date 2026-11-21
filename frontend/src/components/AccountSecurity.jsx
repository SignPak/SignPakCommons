import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Field from './Field'
import { Alert, Button, Eyebrow } from './ui'
import { useAuth } from '../context/AuthContext'
import { paths } from '../routes/appRoutes'
import { api } from '../services/api'
import { applyAuthFieldErrors } from '../utils/authFormErrors'
import { changePasswordSchema } from '../utils/authSchemas'

const EMPTY = { currentPassword: '', password: '', confirmPassword: '' }

/**
 * Profile → Security: change the password while logged in, and log out of every device (S6).
 * Both end every other session; a password change keeps this device signed in.
 */
export default function AccountSecurity() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  })

  const submit = async (values) => {
    setNotice('')
    setError('')
    try {
      await api.users.changePassword(values)
      reset(EMPTY)
      setNotice('Your password is changed. Every other device has been signed out.')
    } catch (cause) {
      if (cause.status === 401) setFieldError('currentPassword', { type: 'server', message: cause.message })
      else if (!applyAuthFieldErrors(cause, setFieldError)) setError(cause.message || 'Your password could not be changed. Try again.')
    }
  }

  const logoutEverywhere = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate(paths.home, { replace: true })
    }
  }

  return (
    <section className="panel panel-outline account-security-panel" aria-labelledby="account-security-title">
      <Eyebrow>Security</Eyebrow>
      <h2 id="account-security-title" className="display display-sm">Your password and sessions.</h2>
      <form onSubmit={handleSubmit(submit)} noValidate aria-label="Change password">
        <Field label="Current password" type="password" autoComplete="current-password" {...register('currentPassword')} error={errors.currentPassword?.message} />
        <Field label="New password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} hint="At least 8 characters." />
        <Field label="Confirm new password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={errors.confirmPassword?.message} />
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" block disabled={isSubmitting}>{isSubmitting ? 'Changing password…' : 'Change password'}</Button>
      </form>
      <p className="panel-copy">Logging out ends your session on every device where you are signed in, including this one.</p>
      <Button variant="outline" block onClick={logoutEverywhere} disabled={loggingOut}>
        {loggingOut ? 'Logging out…' : 'Log out of all devices'}
      </Button>
    </section>
  )
}
