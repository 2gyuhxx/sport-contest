import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { LogOut, User, CheckCircle2 } from 'lucide-react'
import { EventProvider } from '../context/EventContext'
import { AuthProvider } from '../context/AuthContext'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import { classNames } from '../utils/classNames'
import { DevDebugPanel } from '../components/DevDebugPanel'

function AppHeader() {
  const navigate = useNavigate()
  const { state, dispatch } = useAuthContext()
  const { user, isAuthenticated } = state
  const [showLogoutMessage, setShowLogoutMessage] = useState(false)
  const [logoutUserName, setLogoutUserName] = useState<string | null>(null)

  const handleLogout = async () => {
    try {
      // 로그아웃 전에 사용자 이름 저장
      const userName = user?.name || '사용자'
      setLogoutUserName(userName)
      
      await AuthService.logout()
      dispatch({ type: 'LOGOUT' })
      setShowLogoutMessage(true)
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  const handleConfirmLogout = () => {
    setShowLogoutMessage(false)
    setLogoutUserName(null)
    navigate('/')
  }

  return (
    <>
      {/* 로그아웃 성공 모달 */}
      {showLogoutMessage && logoutUserName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">로그아웃 완료</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                {logoutUserName}님 로그아웃 되었습니다!
              </p>
              <button
                onClick={handleConfirmLogout}
                className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="border-b border-surface-subtle bg-white">
        <div className="mx-auto flex max-w-content flex-col gap-3 px-6 py-5 md:py-7">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex flex-col text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              sport contest
            </span>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
                지역 행사 탐색
              </h1>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/my"
                  className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 transition hover:bg-slate-100"
                >
                  <User className="h-4 w-4 text-brand-primary" />
                  <span className="font-semibold text-slate-900">{user.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 transition hover:border-red-400 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 transition hover:text-brand-primary"
                >
                  로그인
                </Link>
                <Link
                  to="/signup"
                  className="rounded-full border border-brand-primary px-4 py-2 text-brand-primary transition hover:bg-brand-primary hover:text-white"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-medium text-slate-600">
          <NavLink
            to="/"
            className={({ isActive }) =>
              classNames(
                'rounded-full px-3 py-1 transition',
                isActive ? 'bg-brand-primary text-white' : 'hover:bg-surface-subtle',
              )
            }
          >
            홈
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              classNames(
                'rounded-full px-3 py-1 transition',
                isActive ? 'bg-brand-primary text-white' : 'hover:bg-surface-subtle',
              )
            }
          >
            행사
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              classNames(
                'rounded-full px-3 py-1 transition',
                isActive ? 'bg-brand-primary text-white' : 'hover:bg-surface-subtle',
              )
            }
          >
            지도 검색
          </NavLink>
          {/* 행사 등록 메뉴는 행사 관리자만 표시 (manager가 true일 때만) */}
          {isAuthenticated && !!user?.manager && (
            <NavLink
              to="/admin/events/create"
              className={({ isActive }) =>
                classNames(
                  'rounded-full px-3 py-1 transition',
                  isActive ? 'bg-brand-primary text-white' : 'hover:bg-surface-subtle',
                )
              }
            >
              행사 등록
            </NavLink>
          )}
        </nav>
      </div>
    </header>
    </>
  )
}

export function AppShell() {
  return (
    <AuthProvider>
      <EventProvider>
        <div className="min-h-screen bg-surface">
          <AppHeader />

          <main className="mx-auto max-w-content px-6 py-12 md:py-18">
            <Outlet />
          </main>

          <footer className="border-t border-surface-subtle bg-white">
            <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-7 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>© 2025 Sport Contest Prototype</span>
              <span>Mock data 기반 프로토타입 · React & Tailwind CSS</span>
            </div>
          </footer>

          {/* 개발자 디버그 패널 (개발 모드에서만 표시) */}
          <DevDebugPanel />
        </div>
      </EventProvider>
    </AuthProvider>
  )
}
