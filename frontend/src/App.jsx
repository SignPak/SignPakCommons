import { useEffect, useState } from 'react'
import Header from './components/Header'
import CategoryBrowser from './pages/CategoryBrowser'
import ProfileDashboard from './pages/ProfileDashboard'
import RecordingEditor from './pages/RecordingEditor'
import { mockLessons } from './mock/data'
import {
  AdminPage,
  AuthPage,
  DemoPage,
  HomePage,
  LandingPage,
  PlayerPage,
} from './pages/pages'
import { ContactPage, PolicyPage, PublicFooter } from './pages/public'

function App() {
  const initialView = window.location.pathname === '/' ? 'landing' : window.location.pathname.slice(1)
  const [view, setView] = useState(initialView || 'landing')
  const [authMode, setAuthMode] = useState('login')
  const [categoryId, setCategoryId] = useState('daily')
  const [selectedLesson, setSelectedLesson] = useState(() => {
    const savedLessonId = Number(window.localStorage.getItem('signpak-last-lesson'))
    return mockLessons.find((lesson) => lesson.id === savedLessonId) || mockLessons[0]
  })
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('signpak-completed') || '[]') } catch { return [] }
  })
  const [sessionActive, setSessionActive] = useState(() => window.localStorage.getItem('signpak-session') === 'active')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingReady, setRecordingReady] = useState(false)
  const [completionNotice, setCompletionNotice] = useState(false)

  const navigate = (nextView) => {
    if (nextView === view) return
    setView(nextView)
    window.history.pushState({}, '', nextView === 'landing' ? '/' : `/${nextView}`)
  }
  useEffect(() => {
    const onPopState = () => setView(window.location.pathname.slice(1) || 'landing')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const openAuth = (mode) => { setAuthMode(mode); navigate('auth') }
  const openCategory = (category) => { setCategoryId(category.id); navigate('category') }
  const openLesson = (lesson) => {
    setSelectedLesson(lesson)
    window.localStorage.setItem('signpak-last-lesson', String(lesson.id))
    setCompletionNotice(false)
    setRecordingReady(false)
    setIsPlaying(true)
    navigate('player')
  }
  const nextLesson = () => {
    const currentIndex = mockLessons.findIndex((lesson) => lesson.id === selectedLesson.id)
    openLesson(mockLessons[(currentIndex + 1) % mockLessons.length])
  }
  const finishRecording = () => { setIsRecording(false); navigate('edit') }
  const submitRecording = () => {
    setCompleted((current) => {
      const nextCompleted = current.includes(selectedLesson.id) ? current : [...current, selectedLesson.id]
      window.localStorage.setItem('signpak-completed', JSON.stringify(nextCompleted))
      return nextCompleted
    })
    setCompletionNotice(true)
    navigate('home')
  }
  const enterWorkspace = () => {
    window.localStorage.setItem('signpak-session', 'active')
    setSessionActive(true)
    navigate('home')
  }

  const content = {
    landing: <LandingPage navigate={navigate} onAuth={openAuth} />,
    auth: <AuthPage mode={authMode} setMode={setAuthMode} onEnter={enterWorkspace} navigate={navigate} />,
    home: <HomePage navigate={navigate} openCategory={openCategory} openLesson={openLesson} completed={completed} />,
    category: <CategoryBrowser categoryId={categoryId} navigate={navigate} openLesson={openLesson} />,
    player: <PlayerPage lesson={selectedLesson} navigate={navigate} isPlaying={isPlaying} setIsPlaying={setIsPlaying} isRecording={isRecording} setIsRecording={setIsRecording} recordingReady={recordingReady} setRecordingReady={setRecordingReady} finishLesson={finishRecording} nextLesson={nextLesson} />,
    edit: <RecordingEditor lesson={selectedLesson} navigate={navigate} recordingReady={recordingReady} submit={submitRecording} />,
    profile: <ProfileDashboard navigate={navigate} completed={completed} />,
    admin: <AdminPage navigate={navigate} />,
    demo: <DemoPage navigate={navigate} onAuth={openAuth} isPlaying={isPlaying} setIsPlaying={setIsPlaying} />,
    contact: <ContactPage navigate={navigate} onAuth={openAuth} />,
    policy: <PolicyPage navigate={navigate} />,
  }[view] || <LandingPage navigate={navigate} onAuth={openAuth} />

  return <div className="min-h-screen overflow-hidden bg-[#f6f2e9] text-[#282824]"><Header navigate={navigate} onAuth={openAuth} sessionActive={sessionActive} />{completionNotice && <div role="status" className="mx-auto flex w-[calc(100%-38px)] max-w-[1160px] items-center justify-between gap-4 border-b border-[#b9cdbd] bg-[#e5efe5] px-5 py-4 text-xs text-[#37563d] lg:w-[calc(100%-64px)]"><span><b className="font-semibold">Recording submitted.</b> Your progress has been updated.</span><button className="text-[#e3533d]" onClick={() => navigate('profile')}>View progress ↗</button></div>}{content}{(view === 'landing' || view === 'contact' || view === 'policy') && <PublicFooter navigate />}</div>
}

export default App
