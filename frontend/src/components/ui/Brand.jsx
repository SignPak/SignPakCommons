import { Link } from 'react-router-dom'
import { join } from './join'
import { paths } from '../../routes/appRoutes'

export function Brand({ light = false, to = paths.home }) {
  return (
    <Link to={to} className={join('brand', light && 'brand-light')}>
      <span className="brand-mark">S</span>
      <span>sign<span className="brand-accent">pak</span></span>
    </Link>
  )
}
