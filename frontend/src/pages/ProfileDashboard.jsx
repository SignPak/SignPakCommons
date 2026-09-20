import { useState } from 'react'
import { Button, Eyebrow, SectionHeading } from '../components/ui'
import { mockLessons, mockUser } from '../mock/data'

const shell = 'mx-auto w-[calc(100%-38px)] max-w-[1160px] lg:w-[calc(100%-64px)]'

export default function ProfileDashboard({ navigate, completed }) {
  const [connections, setConnections] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('signpak-connections') || '{}') } catch { return {} }
  })
  const completionPercent = Math.round((completed.length / mockLessons.length) * 100)
  const toggleConnection = (name) => {
    const next = { ...connections, [name]: !connections[name] }
    setConnections(next)
    window.localStorage.setItem('signpak-connections', JSON.stringify(next))
  }

  return <main className="pb-20"><section className={`${shell} flex flex-col justify-between gap-8 border-b border-[#dcd5c8] py-16 sm:flex-row sm:items-end`}><div><Eyebrow>Your space</Eyebrow><h1 className="font-serif text-6xl">Maya <em className="text-[#e3533d]">Rivera.</em></h1><p className="mt-3 text-sm text-[#858077]">Learning since {mockUser.joined}</p></div><span className="grid h-20 w-20 place-items-center rounded-full bg-[#e9c7a2] text-xl text-[#865a43]">{mockUser.initials}</span></section><section className={`${shell} grid gap-6 pt-12 lg:grid-cols-[1.4fr_.7fr]`}><div className="space-y-6"><div className="bg-[#fbf9f4] p-8"><SectionHeading eyebrow="Your progress" title="Keep going." action={<b className="font-serif text-3xl text-[#e3533d]">{completed.length}/{mockLessons.length}</b>} /><div className="h-2 bg-[#dcd5c8]"><span className="block h-full bg-[#e3533d]" style={{ width: `${Math.max(completionPercent, 4)}%` }} /></div><div className="mt-3 flex justify-between text-[10px] text-[#8f897e]"><span>Lessons complete</span><b className="text-[#282824]">{completionPercent}%</b></div><Button variant="outline" className="mt-7" onClick={() => navigate('home')}>Continue learning ↗</Button></div><div className="bg-[#fbf9f4] p-8"><Eyebrow>Your recordings</Eyebrow><h2 className="font-serif text-4xl">Recent work.</h2>{completed.length ? completed.map((id) => <div key={id} className="mt-5 flex items-center gap-3 border-t border-[#dfd9ce] pt-4 text-xs"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e9a28c] text-white">▶</span><span>{mockLessons.find((lesson) => lesson.id === id)?.title}</span><span className="ml-auto text-[#75a27f]">Submitted</span></div>) : <p className="mt-7 text-sm text-[#908b81]">Your submitted recordings will live here.</p>}</div></div><aside><div className="bg-[#b9cdbd] p-8"><Eyebrow>Connect</Eyebrow><h2 className="font-serif text-4xl">Bring your<br /><em>world in.</em></h2><ConnectionButton label="GitHub" active={connections.github} onClick={() => toggleConnection('github')} /><ConnectionButton label="LinkedIn" active={connections.linkedin} onClick={() => toggleConnection('linkedin')} /></div><div className="mt-6 border border-[#d7d0c3] bg-[#fbf9f4] p-7"><Eyebrow>Workspace</Eyebrow><h2 className="font-serif text-3xl">For the team.</h2><p className="mt-3 text-sm leading-6 text-[#77736c]">Manage lessons, categories and the local content library.</p><button onClick={() => navigate('admin')} className="mt-6 text-xs text-[#e3533d]">Open admin workspace ↗</button></div></aside></section></main>
}

function ConnectionButton({ label, active, onClick }) { return <button className="flex w-full justify-between border-t border-black/20 py-4 text-xs" onClick={onClick}><span>{active ? '✓ Connected to' : '◉ Connect'} {label}</span><span>{active ? 'Disconnect' : '↗'}</span></button> }
