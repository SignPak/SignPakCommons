import { useId } from 'react'

/** Label + control + inline error. `as` can be "input" (default), "textarea" or "select". */
export default function Field({ label, error, hint, id, as: Control = 'input', children, className = '', ...props }) {
  const autoId = useId()
  const fieldId = id || autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  return <div className={`field ${className}`}>
    <label htmlFor={fieldId} className="field-label">{label}</label>
    <Control id={fieldId} className={`field-control field-${Control}`} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props}>{children}</Control>
    {error ? <p id={errorId} className="field-error">{error}</p> : hint ? <p id={hintId} className="field-hint">{hint}</p> : null}
  </div>
}
