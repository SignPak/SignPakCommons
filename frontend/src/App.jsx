import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppLayout } from './components/Layouts'
import { GuestOnly, RequireAdmin, RequireAuth } from './components/RouteGuards'
import { PageState, ButtonLink } from './components/ui'
import { paths, watchEditUrl, watchUrl } from './routes/appRoutes'
import AdminCategories from './pages/admin/AdminCategories'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminVideos from './pages/admin/AdminVideos'
import CategoryBrowser from './pages/CategoryBrowser'
import Demo from './pages/Demo'
import Faq from './pages/Faq'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Player from './pages/Player'
import ProfileDashboard from './pages/ProfileDashboard'
import RecordingEditor from './pages/RecordingEditor'
import Signup from './pages/Signup'

/** Bookmarked/shared links to the old /lesson/:videoId shape still resolve, just redirected to /watch?v=. */
function LegacyWatchRedirect({ edit = false }) {
  const { videoId } = useParams()
  return <Navigate to={edit ? watchEditUrl(videoId) : watchUrl(videoId)} replace />
}

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
            <Route path="videos" element={<AdminVideos />} />
            <Route path="categories" element={<AdminCategories />} />
          </Route>
        </Route>
      </Route>

      {/* Old URLs from before /watch?v= */}
      <Route path="lesson/:videoId" element={<LegacyWatchRedirect />} />
      <Route path="lesson/:videoId/edit" element={<LegacyWatchRedirect edit />} />
      {/* Old URLs from the first prototype */}
      <Route path="category" element={<Navigate to={paths.library} replace />} />
      <Route path="player" element={<Navigate to={paths.library} replace />} />
      <Route path="edit" element={<Navigate to={paths.library} replace />} />
      <Route path="auth" element={<Navigate to={paths.login} replace />} />
      <Route path="contact" element={<Navigate to="/#contact" replace />} />
      <Route path="policy" element={<Navigate to="/#policy" replace />} />
      <Route path="*" element={<PageState eyebrow="404" title="Page not found." action={<ButtonLink to="/">Back home</ButtonLink>}>That page doesn't exist or has moved.</PageState>} />
    </Route>
  </Routes>
}
