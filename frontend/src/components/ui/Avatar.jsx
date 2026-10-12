import { initialsOf } from '../../utils/format'

export function Avatar({ user, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      <span className="avatar-initials">{initialsOf(user)}</span>
    </span>
  )
}
