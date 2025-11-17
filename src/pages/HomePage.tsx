import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { EventList } from '../components/EventList'
import { Sparkles, RefreshCw } from 'lucide-react'

export function HomePage() {
  const {
    state: { events },
    isLoading,
    refreshEvents,
  } = useEventContext()
  
  const { state: authState } = useAuthContext()
  const { isAuthenticated } = authState

  const popularEvents = useMemo(
    () => [...events].sort((a, b) => b.views - a.views),
    [events],
  )

  // 사용자 추천 행사: 다양한 카테고리에서 날짜가 가까운 행사 선택
  const recommendedEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    
    // 카테고리별로 그룹핑
    const byCategory = new Map<string, typeof events>()
    events.forEach(event => {
      if (!byCategory.has(event.category)) {
        byCategory.set(event.category, [])
      }
      byCategory.get(event.category)!.push(event)
    })
    
    // 각 카테고리에서 1~2개씩 선택 (날짜순, 조회수 고려)
    const recommended: typeof events = []
    byCategory.forEach((categoryEvents) => {
      const sorted = [...categoryEvents].sort((a, b) => {
        // 날짜가 오늘 이후인 행사 우선
        const aFuture = a.date >= today ? 1 : 0
        const bFuture = b.date >= today ? 1 : 0
        if (aFuture !== bFuture) return bFuture - aFuture
        
        // 날짜가 가까운 순
        const dateDiff = a.date.localeCompare(b.date)
        if (dateDiff !== 0) return dateDiff
        
        // 조회수 높은 순
        return b.views - a.views
      })
      
      // 각 카테고리에서 상위 1개 선택
      if (sorted.length > 0) {
        recommended.push(sorted[0])
      }
    })
    
    // 추천 점수 기반 정렬 (날짜 가중치 + 조회수)
    return recommended.sort((a, b) => {
      const aScore = (a.date >= today ? 100 : 0) + Math.log(a.views + 1) * 10
      const bScore = (b.date >= today ? 100 : 0) + Math.log(b.views + 1) * 10
      return bScore - aScore
    }).slice(0, 8)
  }, [events])

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
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">
            sport contest finder
          </span>
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

        {/* 사용자 추천 행사 - 로그인 시만 표시 */}
        {isAuthenticated ? (
          <div className="rounded-3xl border border-surface-subtle bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 md:text-3xl">
                  <Sparkles className="h-7 w-7 text-violet-600" />
                  사용자 추천 행사
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  다양한 종목의 행사를 골고루 추천해드려요.
                </p>
              </div>
              <span className="rounded-full bg-violet-600/10 px-3 py-1 text-xs font-semibold text-violet-700">
                AI 추천
              </span>
            </div>
            <EventList
              events={recommendedEvents}
              layout="grid"
              columns={4}
              cardVariant="compact"
              emptyMessage="추천할 행사가 없습니다."
              detailHrefBase="/events/"
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-surface-subtle bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center shadow-sm md:p-12">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-indigo-600" />
            <h2 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">
              맞춤형 행사 추천을 받아보세요
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-slate-600">
              로그인하시면 AI가 분석한 맞춤형 행사 추천을 받아보실 수 있습니다.
              다양한 종목의 행사를 한눈에 확인하고 관심사에 맞는 이벤트를 빠르게 찾아보세요.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                로그인하기
              </Link>
              <Link
                to="/signup"
                className="rounded-full border border-indigo-600 px-6 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                회원가입
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
