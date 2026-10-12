import { join } from './join'

export function Button({ children, variant = 'dark', block = false, className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={join('btn', `btn-${variant}`, block && 'btn-block', className)} {...props}>
      {children}
    </button>
  )
}
