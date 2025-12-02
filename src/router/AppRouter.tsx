import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../ui/AppShell'

// 라우트 기반 코드 분할 (lazy loading)
const EventsPage = lazy(() => import('../pages/EventsPage').then(m => ({ default: m.EventsPage })))
const SearchPage = lazy(() => import('../pages/SearchPage').then(m => ({ default: m.SearchPage })))
const EventDetailPage = lazy(() => import('../pages/EventDetailPage').then(m => ({ default: m.EventDetailPage })))
const CreateEventPage = lazy(() => import('../pages/CreateEventPage').then(m => ({ default: m.CreateEventPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('../pages/SignupPage').then(m => ({ default: m.SignupPage })))
const AuthCallbackPage = lazy(() => import('../pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })))
const MyPage = lazy(() => import('../pages/MyPage').then(m => ({ default: m.MyPage })))
const OAuthSignupPage = lazy(() => import('../pages/OAuthSignupPage').then(m => ({ default: m.OAuthSignupPage })))
const DevTestPage = lazy(() => import('../pages/DevTestPage').then(m => ({ default: m.DevTestPage })))

// 로딩 컴포넌트
function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
        <p className="text-slate-600">페이지를 불러오는 중...</p>
      </div>
    </div>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<PageLoader />}>
                <EventsPage />
              </Suspense>
            }
          />
          <Route
            path="/search"
            element={
              <Suspense fallback={<PageLoader />}>
                <SearchPage />
              </Suspense>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <Suspense fallback={<PageLoader />}>
                <EventDetailPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/events/create"
            element={
              <Suspense fallback={<PageLoader />}>
                <CreateEventPage />
              </Suspense>
            }
          />
          <Route
            path="/admin/events/edit/:eventId"
            element={
              <Suspense fallback={<PageLoader />}>
                <CreateEventPage />
              </Suspense>
            }
          />
          <Route
            path="/my"
            element={
              <Suspense fallback={<PageLoader />}>
                <MyPage />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              <Suspense fallback={<PageLoader />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route
            path="/signup"
            element={
              <Suspense fallback={<PageLoader />}>
                <SignupPage />
              </Suspense>
            }
          />
          <Route
            path="/auth/callback"
            element={
              <Suspense fallback={<PageLoader />}>
                <AuthCallbackPage />
              </Suspense>
            }
          />
          <Route
            path="/oauth/signup"
            element={
              <Suspense fallback={<PageLoader />}>
                <OAuthSignupPage />
              </Suspense>
            }
          />
          {/* 개발자 테스트 페이지 (숨겨진 경로) */}
          <Route
            path="/dev/test"
            element={
              <Suspense fallback={<PageLoader />}>
                <DevTestPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
