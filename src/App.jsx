import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider, AuthProvider, useAuth } from '@/lib/providers'
import { ProtectedRoute, GuestRoute } from '@/lib/router'
import { getRolePath } from '@/lib/auth'
import Layout from '@/components/Admin/Layout/Layout.jsx'

// Pages
import Dashboard from '@/pages/Admin/Dashboard/Dashboard.jsx'
import AdminManga from '@/pages/Admin/Manga/Manga.jsx'
import Chapters from '@/pages/Admin/Chapters/Chapters.jsx'
import Users from '@/pages/Admin/Users/Users.jsx'
import Stats from '@/pages/Admin/Stats/Stats.jsx'
import Profile from '@/pages/Admin/Profile/Profile.jsx'
import Tags from '@/pages/Admin/Tags/Tags.jsx'
import Genres from '@/pages/Admin/Genres/Genres.jsx'
import Home from '@/pages/User/Home/Home.jsx'
import Login from '@/pages/User/Login/Login.jsx'
import Register from '@/pages/User/Register/Register.jsx'
import Mangaka from '@/pages/User/Mangaka/Mangaka.jsx'
import SeriesUploadDetail from '@/pages/User/Mangaka/SeriesUploadDetail.jsx'
import PageLayerWorkspace from '@/pages/User/Mangaka/PageLayerWorkspace.jsx'
import Assistant from '@/pages/User/Assistant/Assistant.jsx'
import Eb from '@/pages/User/Eb/Eb.jsx'
import TantouEditor from '@/pages/User/Tantou/TantouEditor.jsx'
import UserProfile from '@/pages/User/Profile/Profile.jsx'

// Redirects logged-in user to their workspace, else shows Home
function HomeOrWorkspace() {
  const { user, loading, loggingIn } = useAuth()
  console.log('[HomeOrWorkspace] render', { user: !!user, loading, loggingIn })
  if (loading || loggingIn) return null
  if (user) {
    const target = getRolePath(user.role)
    console.log('[HomeOrWorkspace] 🔁 redirect logged-in →', target)
    return <Navigate to={target || '/login'} replace />
  }
  return <Home />
}

function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.split('/').pop() || 'dashboard'

  return (
    <Layout activePage={activePage} onNavigate={id => navigate(`/admin/${id}`)}>
      <Outlet />
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomeOrWorkspace />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/mangaka" element={<Mangaka />} />
              <Route path="/mangaka/series/:seriesSlug" element={<SeriesUploadDetail />} />
              <Route path="/mangaka/series/:seriesSlug/chapter/:chapterId" element={<SeriesUploadDetail />} />
              <Route path="/mangaka/series/:seriesSlug/chapter/:chapterId/page/:pageId" element={<PageLayerWorkspace />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/eb" element={<Eb />} />
              <Route path="/tantou" element={<TantouEditor />} />
              <Route path="/profile" element={<UserProfile />} />
            </Route>

            <Route element={<ProtectedRoute roles={['Admin']} />}>
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="manga" element={<AdminManga />} />
                <Route path="chapters" element={<Chapters />} />
                <Route path="users" element={<Users />} />
                <Route path="genres" element={<Genres />} />
                <Route path="tags" element={<Tags />} />
                <Route path="stats" element={<Stats />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  )
}