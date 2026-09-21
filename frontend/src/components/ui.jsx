import { Link } from 'react-router-dom'
import { initialsOf } from '../utils/format'

const join = (...parts) => parts.filter(Boolean).join(' ')

export function Brand({ light = false, to = '/' }) {
  return <Link to={to} className={join('brand', light && 'brand-light')}><span className="brand-mark">S</span><span>sign<span className="brand-accent">pak</span></span></Link>
}

export function Eyebrow({ children, light = false }) {
  return <p className={join('eyebrow', light && 'eyebrow-light')}>{children}</p>
}

export function Arrow() {
  return <span className="btn-arrow" aria-hidden="true">↗</span>
}

export function Button({ children, variant = 'dark', block = false, className = '', type = 'button', ...props }) {
  return <button type={type} className={join('btn', `btn-${variant}`, block && 'btn-block', className)} {...props}>{children}</button>
}

export function ButtonLink({ to, children, variant = 'dark', block = false, className = '', ...props }) {
  return <Link to={to} className={join('btn', `btn-${variant}`, block && 'btn-block', className)} {...props}>{children}</Link>
}

export function SectionHeading({ eyebrow, title, action }) {
  return <div className="section-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h2 className="display display-md">{title}</h2></div>{action}</div>
}

export function VideoArtwork({ video, className = '', children }) {
  return <div className={join('media', className)} style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined}>{children}</div>
}

export function Alert({ tone = 'info', children }) {
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`alert alert-${tone}`}>{children}</p>
}

export function ProgressBar({ value, label }) {
  const percent = Math.min(100, Math.max(0, value))
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span className="progress-bar" style={{ width: `${percent}%` }} /></div>
}

export function Avatar({ user, size = 'md' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{initialsOf(user)}</span>
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/** Full-page message for empty, missing or blocked states. */
export function PageState({ eyebrow, title, children, action }) {
  return <main className="page-state shell"><Eyebrow>{eyebrow}</Eyebrow><h1 className="display display-lg">{title}</h1><p className="page-state-copy">{children}</p>{action}</main>
}
