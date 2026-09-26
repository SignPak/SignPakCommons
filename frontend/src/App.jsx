import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layouts'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards'
import { PageState, ButtonLink } from './components/ui'
import { paths } from './routes/appRoutes'
import AdminCategories from './pages/admin/AdminCategories'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsers from './pages/admin/AdminUsers'
import AdminVideos from './pages/admin/AdminVideos'
import CategoryBrowser from './pages/CategoryBrowser'
import Demo from './pages/Demo'
import Faq from './pages/Faq'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Player from './pages/Player'
import ProfileDashboard from './pages/ProfileDashboard'
import RecordingEditor from './pages/RecordingEditor'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'

export default function App() {
  return <Routes>
    <Route element={<AppLayout />}>
      {/* Public */}
      <Route index element={<Landing />} />
      <Route path="demo" element={<Demo />} />
      <Route path="faq" element={<Faq />} />
      <Route element={<GuestOnly />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Logged-in contributors */}
      <Route element={<RequireAuth />}>
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
          </Route>
        </Route>
      </Route>

      <Route path="contact" element={<Navigate to={paths.contact} replace />} />
      <Route path="policy" element={<Navigate to={paths.policy} replace />} />
      <Route path="*" element={<PageState eyebrow="404" title="Page not found." action={<ButtonLink to={paths.home}>Back home</ButtonLink>}>That page doesn't exist or has moved.</PageState>} />
    </Route>
  </Routes>
}
