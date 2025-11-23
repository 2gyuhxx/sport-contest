import { useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { LogOut, User, CheckCircle2 } from 'lucide-react'
import { EventProvider } from '../context/EventContext'
import { AuthProvider } from '../context/AuthContext'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import { classNames } from '../utils/classNames'

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
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center">
            <img 
              src="/images/logo.png" 
              alt="어디서하니" 
              className="h-10 w-auto md:h-14"
            />
          </Link>
          <div className="flex items-center gap-3 text-base font-medium text-slate-600">
            {isAuthenticated && user ? (
              <>
                {/* 사용자 이름 (클릭 불가, 살짝 왼쪽 정렬 느낌으로 단독 표시) */}
                <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1">
                  <User className="h-4 w-4 text-brand-primary" />
                  <span className="font-semibold text-slate-900">{user.name}</span>
                </div>
                {/* 별도 마이페이지 버튼 */}
                <Link
                  to="/my"
                  className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
                >
                  마이페이지
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 transition hover:border-red-400 hover:text-red-600"
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
        <nav className="flex flex-wrap gap-3 text-base font-medium text-slate-600">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              classNames(
                'rounded-full px-3 py-1 transition border',
                isActive 
                  ? 'border-brand-primary text-brand-primary' 
                  : 'border-slate-300 hover:border-brand-primary hover:text-brand-primary',
              )
            }
          >
            행사
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              classNames(
                'rounded-full px-3 py-1 transition border',
                isActive 
                  ? 'border-brand-primary text-brand-primary' 
                  : 'border-slate-300 hover:border-brand-primary hover:text-brand-primary',
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
                  'rounded-full px-3 py-1 transition border',
                  isActive 
                    ? 'border-brand-primary text-brand-primary' 
                    : 'border-slate-300 hover:border-brand-primary hover:text-brand-primary',
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
        <div className="flex min-h-screen flex-col bg-surface">
          <AppHeader />

          <main className="mx-auto w-full max-w-content flex-1 px-6 py-4 md:py-4">
            <Outlet />
          </main>

          <footer className="border-t border-surface-subtle bg-white">
            <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-7 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>© 어디서하니</span>
            </div>
          </footer>
        </div>
      </EventProvider>
    </AuthProvider>
  )
}
