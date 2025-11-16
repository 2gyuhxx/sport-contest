import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SearchPage } from '../pages/SearchPage'
import { EventDetailPage } from '../pages/EventDetailPage'
import { CreateEventPage } from '../pages/CreateEventPage'
import { LoginPage } from '../pages/LoginPage'
import { SignupPage } from '../pages/SignupPage'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { MyPage } from '../pages/MyPage'
import { OAuthSignupPage } from '../pages/OAuthSignupPage'
import { AppShell } from '../ui/AppShell'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/admin/events/create" element={<CreateEventPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/oauth/signup" element={<OAuthSignupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
