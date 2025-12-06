import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User, CheckCircle2, Search, Map, X } from 'lucide-react'
import { EventProvider } from '../context/EventContext'
import { AuthProvider } from '../context/AuthContext'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import { classNames } from '../utils/classNames'
import { useIsMobile } from '../hooks/useMediaQuery'

// 로그아웃 확인 모달
function LogoutConfirmModal({ show, onClose, onConfirm }: { show: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!show) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="floating-card mx-4 w-full max-w-sm p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <LogOut className="h-7 w-7 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">로그아웃</h3>
          </div>
        </div>
        <p className="text-base text-gray-600 mb-8">
          로그아웃 하시겠습니까?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 rounded-[24px] py-4 font-semibold transition hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#2563EB] text-white rounded-[24px] py-4 font-semibold transition hover:bg-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

// 로그아웃 완료 모달
function LogoutModal({ show, onClose, userName }: { show: boolean; onClose: () => void; userName: string | null }) {
  if (!show) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="floating-card mx-4 w-full max-w-sm p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">로그아웃 완료</h3>
          </div>
        </div>
        <p className="text-base text-gray-600 mb-8">
          {userName}님 로그아웃 되었습니다!
        </p>
        <button
          onClick={onClose}
          className="w-full bg-[#2563EB] text-white rounded-[24px] py-4 font-semibold transition hover:bg-[#1d4ed8] shadow-[0_4px_12px_rgba(37,99,235,0.3)]"
        >
          확인
        </button>
      </div>
    </div>
  )
}

// 플로팅 아일랜드 헤더
function FloatingHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useAuthContext()
  const { user, isAuthenticated } = state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showLogoutMessage, setShowLogoutMessage] = useState(false)
  const [logoutUserName, setLogoutUserName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const isMobile = useIsMobile()

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
  }

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false)
    try {
      const userName = user?.name || '사용자'
      setLogoutUserName(userName)
      await AuthService.logout()
      dispatch({ type: 'LOGOUT' })
      setShowLogoutMessage(true)
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const targetPath = location.pathname === '/search' ? '/search' : '/'
      navigate(`${targetPath}?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      const targetPath = location.pathname === '/search' ? '/search' : '/'
      navigate(targetPath)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    const targetPath = location.pathname === '/search' ? '/search' : '/'
    navigate(targetPath)
  }

  const handleLogoClick = () => {
    setSearchQuery('')
    // 완전 초기화를 위해 쿼리 파라미터 없이 홈으로 이동
    navigate('/', { replace: true })
    // 페이지 새로고침으로 모든 상태 초기화
    window.location.href = '/'
  }

  // URL 쿼리 파라미터에서 검색어 읽기
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const query = params.get('q')
    if (query) {
      setSearchQuery(query)
    } else {
      setSearchQuery('')
    }
  }, [location.search])

  return (
    <>
      <LogoutConfirmModal
        show={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogoutConfirm}
      />
      <LogoutModal
        show={showLogoutMessage}
        onClose={() => {
          setShowLogoutMessage(false)
          setLogoutUserName(null)
          navigate('/')
        }}
        userName={logoutUserName}
      />
      
      <header className="floating-header">
        {/* 모바일: 2줄 레이아웃, 데스크탑: 1줄 레이아웃 */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 min-w-0">
          {/* 첫 번째 줄: 로고 + 네비게이션 + 로그인 (모바일) */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 md:flex-initial">
            {/* 로고 */}
            <button
              onClick={handleLogoClick}
              className="flex items-center flex-shrink-0 hover:opacity-80 transition-opacity"
              aria-label="홈으로 이동"
            >
              <img 
                src="/images/logo.png" 
                alt="어디서하니" 
                className="h-7 md:h-8 w-auto"
              />
            </button>

            {/* 네비게이션 버튼 */}
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <Link
                to="/"
                onClick={() => setSearchQuery('')}
                className={classNames(
                  'px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all duration-200 font-medium text-xs md:text-sm whitespace-nowrap backdrop-blur-xl',
                  location.pathname === '/'
                    ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] border border-white/20'
                    : 'bg-white/95 text-[#1d1d1f] hover:bg-white border border-white/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                )}
                style={{ WebkitBackdropFilter: 'blur(40px)' }}
              >
                행사
              </Link>
              <Link
                to="/search"
                onClick={() => setSearchQuery('')}
                className={classNames(
                  'px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all duration-200 font-medium text-xs md:text-sm flex items-center gap-1.5 md:gap-2 whitespace-nowrap backdrop-blur-xl',
                  location.pathname === '/search'
                    ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] border border-white/20'
                    : 'bg-white/95 text-[#1d1d1f] hover:bg-white border border-white/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                )}
                style={{ WebkitBackdropFilter: 'blur(40px)' }}
              >
                <Map className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                {!isMobile && <span>지도 검색</span>}
              </Link>
              {/* 관리자 또는 행사 주최자만 행사 등록 탭 표시 */}
              {isAuthenticated && user && (user.manager === 1 || user.manager === 2) && (
                <Link
                  to="/admin/events/create"
                  onClick={() => setSearchQuery('')}
                  className={classNames(
                    'px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all duration-200 font-medium text-xs md:text-sm whitespace-nowrap backdrop-blur-xl',
                    location.pathname === '/admin/events/create' || location.pathname.startsWith('/admin/events/edit/')
                      ? 'bg-[#007AFF] text-white shadow-[0_4px_12px_rgba(0,122,255,0.4)] border border-white/20'
                      : 'bg-white/95 text-[#1d1d1f] hover:bg-white border border-white/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  )}
                  style={{ WebkitBackdropFilter: 'blur(40px)' }}
                >
                  {isMobile ? '등록' : '행사 등록'}
                </Link>
              )}
            </div>

            {/* 모바일에서만 로그인 버튼을 첫 번째 줄에 표시 */}
            {isMobile && (
              <>
                {isAuthenticated && user ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                    <Link
                      to="/my"
                      className="flex items-center justify-center h-8 w-8 rounded-full bg-[#2563EB] hover:bg-[#1d4ed8] transition"
                    >
                      <User className="h-4 w-4 text-white" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                    <Link
                      to="/login"
                      className="px-3 py-1.5 rounded-full bg-white/50 hover:bg-white/80 transition font-medium text-xs text-gray-700 whitespace-nowrap"
                    >
                      로그인
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 검색 - 모바일: 두 번째 줄, 데스크탑: 같은 줄 (더 길게) */}
          <form onSubmit={handleSearch} className="relative min-w-0 flex-1 md:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="행사 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e)
                }
              }}
              className="w-full pl-10 md:pl-12 pr-10 md:pr-12 py-2 md:py-3 bg-white/50 rounded-[20px] border-0 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 text-sm md:text-base text-gray-900 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                aria-label="검색어 지우기"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            )}
          </form>
          
          {/* 사용자 프로필 - 데스크탑에서만 표시 (오른쪽 끝) */}
          {!isMobile && (
            <>
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  <Link
                    to="/my"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-[20px] bg-white/50 hover:bg-white/80 transition whitespace-nowrap"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </Link>
                  <button
                    onClick={handleLogoutClick}
                    className="p-2.5 rounded-[20px] bg-white/50 hover:bg-white/80 transition flex-shrink-0"
                    title="로그아웃"
                  >
                    <LogOut className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    to="/login"
                    className="px-4 py-2.5 rounded-[20px] bg-white/50 hover:bg-white/80 transition font-medium text-gray-700 whitespace-nowrap"
                  >
                    로그인
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2.5 rounded-[20px] bg-[#2563EB] text-white hover:bg-[#1d4ed8] transition font-medium shadow-[0_4px_12px_rgba(37,99,235,0.3)] whitespace-nowrap"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </header>
    </>
  )
}

export function AppShell() {
  const location = useLocation()
  const isFullScreenPage = location.pathname === '/search'

  return (
    <AuthProvider>
      <EventProvider>
        <div className={`flex min-h-screen flex-col ${isFullScreenPage ? '' : 'bg-[#F5F7FA]'}`}>
          {!isFullScreenPage && <FloatingHeader />}

          <main className={isFullScreenPage ? 'flex-1' : 'flex-1 pt-44 md:pt-28 pb-12'}>
            <Outlet />
          </main>

          {!isFullScreenPage && (
            <footer className="border-t-0 bg-transparent py-3 md:py-4">
              <div className="mx-auto flex max-w-content flex-col gap-2 md:gap-3 px-6 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                <span>Copyright 2025 by Shift+Delete</span>
                <div className="text-left space-y-0.5 leading-tight">
                  <div>안유리 (PL&PM) - ahnyuri4900@gmail.com</div>
                  <div>이규현 (AA&TA) - home543095@naver.com</div>
                  <div>임형근 (DA&AA) - lhgdream4@naver.com</div>
                  <div>하승연 (BA&PM) - haa020206@gmail.com</div>
                </div>
              </div>
            </footer>
          )}
        </div>
      </EventProvider>
    </AuthProvider>
  )
}
