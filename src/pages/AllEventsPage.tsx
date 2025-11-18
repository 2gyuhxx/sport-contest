import { useMemo, useState } from 'react'
import { useEventContext } from '../context/useEventContext'
import { EventList } from '../components/EventList'
import { Search, Filter, Grid, List, Loader2 } from 'lucide-react'

export function AllEventsPage() {
  const {
    state: { events, isLoading },
  } = useEventContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'title'>('date')
  const [layout, setLayout] = useState<'grid' | 'stack'>('grid')

  // 카테고리 목록
  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    events.forEach((event) => {
      categorySet.add(event.category)
    })
    return Array.from(categorySet).sort()
  }, [events])

  // 필터링 및 정렬된 행사 목록
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...events]

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.summary?.toLowerCase().includes(query) ||
          event.city.toLowerCase().includes(query) ||
          event.address.toLowerCase().includes(query),
      )
    }

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((event) => event.category === selectedCategory)
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return a.date.localeCompare(b.date)
        case 'views':
          return b.views - a.views
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return filtered
  }, [events, searchQuery, selectedCategory, sortBy])

  return (
    <div className="space-y-8 pb-16">
      {/* 헤더 */}
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-white md:p-12">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold md:text-4xl">전체 행사</h1>
          <p className="mt-2 text-white/90">
            등록된 모든 행사를 확인하고 탐색하세요.
          </p>
        </div>
      </section>

      {/* 필터 및 검색 */}
      <section className="mx-auto max-w-5xl space-y-6">
        {/* 검색바 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="행사명, 설명, 지역으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        {/* 필터 및 정렬 */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          {/* 카테고리 필터 */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="all">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">정렬:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'views' | 'title')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="date">날짜순</option>
              <option value="views">조회순</option>
              <option value="title">제목순</option>
            </select>
          </div>

          {/* 레이아웃 선택 */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              className={`rounded-lg p-2 transition ${
                layout === 'grid'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayout('stack')}
              className={`rounded-lg p-2 transition ${
                layout === 'stack'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 결과 통계 */}
        {!isLoading && (
          <div className="text-sm text-slate-600">
            총 <span className="font-semibold text-brand-primary">{filteredAndSortedEvents.length}개</span>의 행사가
            있습니다.
          </div>
        )}

        {/* 행사 목록 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-primary" />
                <p className="mt-4 text-slate-600">행사 목록을 불러오는 중...</p>
              </div>
            </div>
          ) : filteredAndSortedEvents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-slate-500">
                {searchQuery || selectedCategory !== 'all'
                  ? '조건에 맞는 행사가 없습니다.'
                  : '등록된 행사가 없습니다.'}
              </p>
            </div>
          ) : (
            <EventList
              events={filteredAndSortedEvents}
              layout={layout}
              columns={layout === 'grid' ? 3 : 1}
              cardVariant="default"
              emptyMessage="행사가 없습니다."
              detailHrefBase="/events/"
            />
          )}
        </div>
      </section>
    </div>
  )
}

