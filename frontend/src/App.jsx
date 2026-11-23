import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layouts'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards'
import { PageState, ButtonLink } from './components/ui'
import { paths } from './routes/appRoutes'
import Landing from './pages/Landing'

// Every page but the landing page is loaded on first visit, so it stays out of the main chunk
// every visitor downloads (FIX-PLAN Phase 9 item 4: under 300 kB, checked by
// scripts/checkBundleSize.js). The layouts' <Suspense> shows a loading line meanwhile.
const CategoryBrowser = lazy(() => import('./pages/CategoryBrowser'))
const Consent = lazy(() => import('./pages/Consent'))
const ContactVerify = lazy(() => import('./pages/ContactVerify'))
const Demo = lazy(() => import('./pages/Demo'))
const Faq = lazy(() => import('./pages/Faq'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Player = lazy(() => import('./pages/Player'))
const ProfileDashboard = lazy(() => import('./pages/ProfileDashboard'))
const Signup = lazy(() => import('./pages/Signup'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'))
const AdminSubmissions = lazy(() => import('./pages/admin/AdminSubmissions'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminVideos = lazy(() => import('./pages/admin/AdminVideos'))
const RecordingEditor = lazy(() => import('./pages/RecordingEditor'))

export default function App() {
  return <Routes>
    <Route element={<AppLayout />}>
      {/* Public */}
      <Route index element={<Landing />} />
      <Route path="demo" element={<Demo />} />
      <Route path="faq" element={<Faq />} />
      {/* D4: outside the guards, because the sender may be signed out or have no account any more. */}
      <Route path="contact/verify" element={<ContactVerify />} />
      <Route element={<GuestOnly />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="signup/consent" element={<Consent mode="signup" />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Logged-in contributors */}
      <Route element={<RequireAuth />}>
        <Route path="consent" element={<Consent />} />
        <Route path="home" element={<Home />} />
        <Route path="library/:categoryId" element={<CategoryBrowser />} />
        <Route path="watch" element={<Player />} />
        <Route path="watch/edit" element={<RecordingEditor />} />
        <Route path="profile" element={<ProfileDashboard />} />

        {/* Admins only */}
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>
        </Route>
      </Route>

      <Route path="contact" element={<Navigate to={paths.contact} replace />} />
      <Route path="policy" element={<Navigate to={paths.policy} replace />} />
      <Route path="*" element={<PageState eyebrow="404" title="Page not found." action={<ButtonLink to={paths.home}>Back home</ButtonLink>}>That page doesn't exist or has moved.</PageState>} />
    </Route>
  </Routes>
}
