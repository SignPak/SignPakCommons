import { Link } from 'react-router-dom'
import { join } from './join'
import { paths } from '../../routes/appRoutes'

export function Brand({ light = false, to = paths.home }) {
  return (
    <Link to={to} className={join('brand', light && 'brand-light')}>
      <svg className="brand-mark" viewBox="0 0 384 316" aria-hidden="true">
        <use href="/favicon.svg#signpak-logo" />
      </svg>
      <span>sign<span className="brand-accent">pak</span></span>
    </Link>
  )
}
