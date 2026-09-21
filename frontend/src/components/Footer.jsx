import { Link } from 'react-router-dom'
import { LOREM_SHORT } from '../mock/lorem'
import { Brand } from './ui'

export default function Footer() {
  return <footer className="site-footer">
    <div className="shell site-footer-grid">
      <div><Brand light /><p className="site-footer-copy">{LOREM_SHORT}</p></div>
      <div><p className="footer-title">Explore</p><div className="footer-links"><Link to="/demo">How it works</Link><Link to="/#about">About</Link><Link to="/signup">Create an account</Link></div></div>
      <div><p className="footer-title">Good to know</p><div className="footer-links"><Link to="/#policy">Policy</Link><Link to="/#contact">Contact us</Link></div></div>
    </div>
    <div className="shell site-footer-base"><span>Signpak Commons</span><span>© 2026 Signpak. Lorem ipsum dolor sit amet.</span></div>
  </footer>
}
