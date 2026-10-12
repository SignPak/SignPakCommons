import { Link } from 'react-router-dom'
import { paths } from '../routes/appRoutes'
import { Eyebrow } from './ui'

/** Split layout shared by the login and signup pages. */
export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <main className="auth">
      <div className="auth-art feature">
        <div className="auth-art-copy">
          <Eyebrow light>SIGN PAK</Eyebrow>
          <h2 className="display display-lg">
            Help us to make<br /><em>communication easier.</em>
          </h2>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <Link to={paths.home} className="auth-back">Back</Link>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="display display-lg">{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
          {footer && <p className="auth-footer">{footer}</p>}
        </div>
      </div>
    </main>
  )
}
