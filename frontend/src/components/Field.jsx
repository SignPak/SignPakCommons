import { useId, useState } from 'react'

/** Label + control + inline error. `as` can be "input" (default), "textarea" or "select". */
export default function Field({ label, error, hint, id, type, as: Control = 'input', children, className = '', ...props }) {
  const autoId = useId()
  const fieldId = id || autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = Control === 'input' && type === 'password'
  return <div className={`field ${className}`}>
    <label htmlFor={fieldId} className="field-label">{label}</label>
    {isPassword
      ? <div className="field-password-wrap">
        <Control id={fieldId} type={passwordVisible ? 'text' : 'password'} className={`field-control field-${Control} field-password-input`} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props}>{children}</Control>
        <button
          type="button"
          className="password-visibility-toggle"
          aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          aria-controls={fieldId}
          aria-pressed={passwordVisible}
          onClick={() => setPasswordVisible((visible) => !visible)}
        >
          {passwordVisible
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 002.7 2.7" /><path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7a11.5 11.5 0 01-3.1 4.2M6.2 6.2A12 12 0 002.5 12c1 2.5 4.5 7 9.5 7 1.4 0 2.7-.4 3.8-1" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="2.5" /></svg>}
        </button>
      </div>
      : <Control id={fieldId} type={type} className={`field-control field-${Control}`} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props}>{children}</Control>}
    {error ? <p id={errorId} className="field-error">{error}</p> : hint ? <p id={hintId} className="field-hint">{hint}</p> : null}
  </div>
}
