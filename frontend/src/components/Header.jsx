import { Brand, Button } from './ui'

export default function Header({ navigate, onAuth, sessionActive }) {
  return <header className="relative z-10 mx-auto flex h-[86px] w-[calc(100%-38px)] max-w-[1280px] items-center justify-between lg:w-[calc(100%-64px)]">
    <Brand onClick={() => navigate('landing')} />
    <nav className="hidden items-center gap-8 text-xs text-[#6d6a63] md:flex"><button onClick={() => navigate(sessionActive ? 'home' : 'demo')}>{sessionActive ? 'Library' : 'How it works'}</button><button onClick={() => navigate('landing')}>About</button><button onClick={() => navigate('contact')}>Contact</button></nav>
    <div className="flex items-center gap-3">{sessionActive ? <><Button variant="ghost" className="hidden sm:block" onClick={() => navigate('profile')}>My space</Button><Button onClick={() => navigate('home')}>Open library <span className="ml-3 text-base">↗</span></Button></> : <><Button variant="ghost" className="hidden sm:block" onClick={() => onAuth('login')}>Log in</Button><Button onClick={() => onAuth('signup')}>Get started <span className="ml-3 text-base">↗</span></Button></>}<button className="text-xl md:hidden" onClick={() => navigate(sessionActive ? 'home' : 'demo')} aria-label={sessionActive ? 'Open library' : 'See how Signpak works'}>☰</button></div>
  </header>
}
