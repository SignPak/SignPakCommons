import { Link } from 'react-router-dom'
import { join } from './join'

export function ButtonLink({ to, children, variant = 'dark', block = false, className = '', ...props }) {
  return (
    <Link to={to} className={join('btn', `btn-${variant}`, block && 'btn-block', className)} {...props}>
      {children}
    </Link>
  )
}
