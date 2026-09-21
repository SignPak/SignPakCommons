import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/Layouts'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards'
import { PageState, ButtonLink } from './components/ui'
import AdminCategories from './pages/admin/AdminCategories'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminVideos from './pages/admin/AdminVideos'
import CategoryBrowser from './pages/CategoryBrowser'
import Demo from './pages/Demo'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Player from './pages/Player'
import ProfileDashboard from './pages/ProfileDashboard'
import RecordingEditor from './pages/RecordingEditor'
import Signup from './pages/Signup'

export default function App() {
  return <Routes>
    <Route element={<AppLayout />}>
      {/* Public */}
      <Route index element={<Landing />} />
      <Route path="demo" element={<Demo />} />
      <Route element={<GuestOnly />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
      </Route>

      {/* Logged-in learners */}
      <Route element={<RequireAuth />}>
        <Route path="home" element={<Home />} />
        <Route path="library/:categoryId" element={<CategoryBrowser />} />
        <Route path="lesson/:videoId" element={<Player />} />
        <Route path="lesson/:videoId/edit" element={<RecordingEditor />} />
        <Route path="profile" element={<ProfileDashboard />} />

        {/* Admins only */}
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="categories" element={<AdminCategories />} />
          </Route>
        </Route>
      </Route>

      {/* Old URLs from the first prototype */}
      <Route path="category" element={<Navigate to="/home" replace />} />
      <Route path="player" element={<Navigate to="/home" replace />} />
      <Route path="edit" element={<Navigate to="/home" replace />} />
      <Route path="auth" element={<Navigate to="/login" replace />} />
      <Route path="contact" element={<Navigate to="/#contact" replace />} />
      <Route path="policy" element={<Navigate to="/#policy" replace />} />
      <Route path="*" element={<PageState eyebrow="404" title="Page not found." action={<ButtonLink to="/">Back home</ButtonLink>}>That page doesn't exist or has moved.</PageState>} />
    </Route>
  </Routes>
}
