import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useEventContext } from '../context/useEventContext'
import { EventList } from '../components/EventList'
import { RefreshCw } from 'lucide-react'

export function HomePage() {
  const {
    state: { events },
    isLoading,
    refreshEvents,
  } = useEventContext()

  const popularEvents = useMemo(
    () => [...events].sort((a, b) => b.views - a.views),
    [events],
  )

  // 로딩 중일 때 표시
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
          <p className="text-slate-600">행사 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-16 pb-16">
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-10 text-white md:p-16">
        <div className="mx-auto flex max-w-content flex-col gap-7">
          <img 
            src="/images/top_tab_logo.png" 
            alt="어디서하니" 
            className="h-8 w-auto md:h-10"
          />
          <h1 className="text-3xl font-bold md:text-5xl">
            지역별 스포츠 행사 정보를 한눈에 확인하세요
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            축구, 마라톤, e스포츠 등 다양한 종목의 지역 행사를 한 곳에서 탐색하고
            관심있는 이벤트를 빠르게 찾아보세요.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/search"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-secondary transition hover:bg-surface"
            >
              지도에서 행사 찾기
            </Link>
            <Link
              to="/search?category=football"
              className="rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              인기 종목 살펴보기
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-content flex-col gap-12 px-6">
        {/* 인기 행사 TOP */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                인기 행사 TOP
              </h2>
              <p className="text-sm text-slate-600">
                조회수가 높은 행사부터 빠르게 살펴보세요.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshEvents}
                disabled={isLoading}
                className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                title="행사 목록 새로고침"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
              <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                조회순
              </span>
            </div>
          </div>
          <EventList
            events={popularEvents.slice(0, 8)}
            layout="grid"
            columns={4}
            cardVariant="compact"
            emptyMessage="현재 인기 행사가 없습니다."
            detailHrefBase="/events/"
          />
        </div>
      </section>
    </div>
  )
}
