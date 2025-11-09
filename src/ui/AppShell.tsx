import { NavLink, Outlet, Link } from 'react-router-dom'
import { EventProvider } from '../context/EventContext'
import { classNames } from '../utils/classNames'

export function AppShell() {
  return (
    <EventProvider>
      <div className="min-h-screen bg-surface">
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
                <button
                  type="button"
                  className="rounded-full px-4 py-2 transition hover:text-brand-primary"
                >
                  로그인
                </button>
                <button
                  type="button"
                  className="rounded-full border border-brand-primary px-4 py-2 text-brand-primary transition hover:bg-brand-primary hover:text-white"
                >
                  회원가입
                </button>
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
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-content px-6 py-12 md:py-18">
          <Outlet />
        </main>

        <footer className="border-t border-surface-subtle bg-white">
          <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-7 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>© 2025 Sport Contest Prototype</span>
            <span>Mock data 기반 프로토타입 · React & Tailwind CSS</span>
          </div>
        </footer>
      </div>
    </EventProvider>
  )
}
