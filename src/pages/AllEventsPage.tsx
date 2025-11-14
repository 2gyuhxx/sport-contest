import { useMemo, useState } from 'react'
import { useEventContext } from '../context/useEventContext'
import { EventList } from '../components/EventList'
import { CategoryFilter } from '../components/CategoryFilter'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { Category } from '../types/events'

type SortOption = 'date-asc' | 'date-desc' | 'views-desc' | 'title-asc'

export function AllEventsPage() {
  const {
    state: { events, regions, categories },
  } = useEventContext()

  const [keyword, setKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('date-asc')

  // 필터링 및 정렬
  const filteredAndSortedEvents = useMemo(() => {
    let result = [...events]

    // 키워드 검색
    if (keyword.trim()) {
      const lowerKeyword = keyword.toLowerCase()
      result = result.filter(
        (event) =>
          event.title.toLowerCase().includes(lowerKeyword) ||
          event.summary.toLowerCase().includes(lowerKeyword) ||
          event.city.toLowerCase().includes(lowerKeyword),
      )
    }

    // 카테고리 필터
    if (selectedCategory) {
      result = result.filter((event) => event.category === selectedCategory)
    }

    // 지역 필터
    if (selectedRegion) {
      result = result.filter((event) => event.region === selectedRegion)
    }

    // 정렬
    switch (sortBy) {
      case 'date-asc':
        result.sort((a, b) => a.date.localeCompare(b.date))
        break
      case 'date-desc':
        result.sort((a, b) => b.date.localeCompare(a.date))
        break
      case 'views-desc':
        result.sort((a, b) => b.views - a.views)
        break
      case 'title-asc':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
    }

    return result
  }, [events, keyword, selectedCategory, selectedRegion, sortBy])

  const handleResetFilters = () => {
    setKeyword('')
    setSelectedCategory(null)
    setSelectedRegion(null)
    setSortBy('date-asc')
  }

  const hasActiveFilters = keyword || selectedCategory || selectedRegion || sortBy !== 'date-asc'

  return (
    <div className="space-y-8 pb-16">
      {/* 헤더 */}
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-white md:p-12">
        <div className="mx-auto max-w-content">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            all events
          </span>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">전체 행사</h1>
          <p className="mt-3 text-white/90">
            총 <strong>{events.length}개</strong>의 스포츠 행사를 확인하세요
          </p>
        </div>
      </section>

      {/* 필터 영역 */}
      <section className="mx-auto max-w-content space-y-6 px-6">
        {/* 검색 & 정렬 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 검색 */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="행사명, 지역 검색..."
              className="w-full rounded-xl border border-surface-subtle bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-surface-subtle bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="date-asc">날짜 빠른순</option>
              <option value="date-desc">날짜 느린순</option>
              <option value="views-desc">조회수 높은순</option>
              <option value="title-asc">이름순</option>
            </select>
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="rounded-2xl border border-surface-subtle bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">종목</div>
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {/* 지역 필터 */}
        <div className="rounded-2xl border border-surface-subtle bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">지역</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedRegion(null)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectedRegion === null
                  ? 'bg-brand-primary text-white'
                  : 'bg-surface text-slate-700 hover:bg-surface-subtle'
              }`}
            >
              전체
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  selectedRegion === region.id
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface text-slate-700 hover:bg-surface-subtle'
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>
        </div>

        {/* 필터 초기화 & 결과 수 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-900">
              {filteredAndSortedEvents.length}개
            </strong>
            의 행사
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      </section>

      {/* 행사 목록 */}
      <section className="mx-auto max-w-content px-6">
        <EventList
          events={filteredAndSortedEvents}
          layout="grid"
          columns={4}
          cardVariant="default"
          emptyMessage="조건에 맞는 행사가 없습니다."
          detailHrefBase="/events/"
        />
      </section>
    </div>
  )
}

