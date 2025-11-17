import { useState, useMemo, useEffect } from 'react'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { EventList } from '../components/EventList/EventList'
import { EventService, type SportCategory, type SubSportCategory } from '../services/EventService'
import { Filter, TrendingUp, Calendar, Clock, ChevronDown, Sparkles } from 'lucide-react'

type SortOption = 'latest' | 'popular' | 'date' | 'title' | 'recommended'

const SORT_OPTIONS = [
  { value: 'recommended' as const, label: '추천', icon: Sparkles, requiresAuth: true },
  { value: 'latest' as const, label: '최신순', icon: Clock },
  { value: 'popular' as const, label: '인기순', icon: TrendingUp },
  { value: 'date' as const, label: '행사일순', icon: Calendar },
  { value: 'title' as const, label: '이름순', icon: Filter },
]

export function EventsPage() {
  const {
    state: { events, regions },
    isLoading,
  } = useEventContext()
  
  const { state: authState } = useAuthContext()
  const { isAuthenticated, user } = authState

  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'stack'>('grid')
  
  // 대분류/소분류 상태
  const [sportCategories, setSportCategories] = useState<SportCategory[]>([])
  const [subSportCategories, setSubSportCategories] = useState<SubSportCategory[]>([])
  const [selectedSportCategoryId, setSelectedSportCategoryId] = useState<number | null>(null)
  const [selectedSubSportCategoryId, setSelectedSubSportCategoryId] = useState<number | null>(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // 대분류 카테고리 로드
  useEffect(() => {
    const loadSportCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const categories = await EventService.getSportCategoriesDB()
        setSportCategories(categories)
      } catch (err) {
        console.error('스포츠 카테고리 로드 오류:', err)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    loadSportCategories()
  }, [])

  // 대분류 선택 시 소분류 로드
  useEffect(() => {
    const loadSubCategories = async () => {
      if (!selectedSportCategoryId) {
        setSubSportCategories([])
        setSelectedSubSportCategoryId(null)
        return
      }

      try {
        const subCategories = await EventService.getSubSportCategories(selectedSportCategoryId)
        setSubSportCategories(subCategories)
        setSelectedSubSportCategoryId(null)
      } catch (err) {
        console.error('소분류 카테고리 로드 오류:', err)
        setSubSportCategories([])
      }
    }
    loadSubCategories()
  }, [selectedSportCategoryId])

  // 필터링 및 정렬
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = [...events]

    // 소분류 카테고리 필터 (sport 필드로 정확하게 필터링)
    if (selectedSubSportCategoryId) {
      const selectedSubCategory = subSportCategories.find(sub => sub.id === selectedSubSportCategoryId)
      if (selectedSubCategory) {
        filtered = filtered.filter((event) => event.sport === selectedSubCategory.name)
      }
    }

    // 지역 필터
    if (selectedRegion) {
      filtered = filtered.filter((event) => event.region === selectedRegion)
    }

    // 정렬
    switch (sortBy) {
      case 'recommended':
        // 추천 정렬: 사용자의 관심 카테고리를 기반으로 추천
        if (user?.interests && user.interests.length > 0) {
          filtered.sort((a, b) => {
            // 사용자의 관심 카테고리 이름 배열
            const userInterests = user.interests as string[]
            
            // 행사 설명에 관심 카테고리가 포함되어 있는지 확인 (간단한 매칭)
            const aScore = userInterests.some(interest => 
              a.title.includes(interest) || a.description?.includes(interest)
            ) ? 1000 : 0
            const bScore = userInterests.some(interest => 
              b.title.includes(interest) || b.description?.includes(interest)
            ) ? 1000 : 0
            
            // 관심 카테고리 매칭 점수 + 조회수 + 날짜 가중치
            const today = new Date().toISOString().split('T')[0]
            const aDateScore = a.date >= today ? 500 : 0
            const bDateScore = b.date >= today ? 500 : 0
            
            const aTotal = aScore + aDateScore + Math.log(a.views + 1) * 10
            const bTotal = bScore + bDateScore + Math.log(b.views + 1) * 10
            
            return bTotal - aTotal
          })
        } else {
          // 로그인하지 않았거나 관심사가 없으면 인기순으로 폴백
          filtered.sort((a, b) => b.views - a.views)
        }
        break
      case 'latest':
        // created_at이 없으므로 ID를 기준으로 (ID가 클수록 최신)
        filtered.sort((a, b) => parseInt(b.id) - parseInt(a.id))
        break
      case 'popular':
        filtered.sort((a, b) => b.views - a.views)
        break
      case 'date':
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        break
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title, 'ko'))
        break
    }

    return filtered
  }, [events, selectedSubSportCategoryId, selectedRegion, sortBy, user, subSportCategories])

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
    <div className="bg-surface pb-20 pt-10">
      <div className="mx-auto max-w-content px-4 lg:px-6">
        {/* 헤더 */}
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">all events</p>
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">행사</h1>
          <p className="mt-2 text-slate-600">
            전국의 다양한 체육 행사를 확인하고 참여하세요
          </p>
        </header>

        {/* 필터 및 정렬 */}
        <div className="mb-6 rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* 정렬 옵션 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">정렬:</span>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const requiresAuth = option.requiresAuth || false
                  const isDisabled = requiresAuth && !isAuthenticated
                  
                  return (
                    <div key={option.value} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          if (isDisabled) {
                            alert('추천 기능은 로그인 후 이용할 수 있습니다.')
                            return
                          }
                          setSortBy(option.value)
                        }}
                        disabled={isDisabled}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          sortBy === option.value
                            ? 'bg-brand-primary text-white'
                            : isDisabled
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-surface text-slate-700 hover:bg-slate-200'
                        }`}
                        title={isDisabled ? '로그인 필요' : ''}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                        {requiresAuth && (
                          <span className={`text-xs ${sortBy === option.value ? 'text-white/70' : 'text-slate-500'}`}>
                            🔒
                          </span>
                        )}
                      </button>
                      {isDisabled && (
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 group-hover:block">
                          <div className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
                            로그인 후 이용 가능
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 레이아웃 전환 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">보기:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    layoutMode === 'grid'
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  그리드
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('stack')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    layoutMode === 'stack'
                      ? 'bg-brand-primary text-white'
                      : 'bg-surface text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  리스트
                </button>
              </div>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="mt-4 flex flex-col gap-4 border-t border-surface-subtle pt-4 md:flex-row">
            {/* 대분류 필터 */}
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                종목 대분류
              </label>
              <div className="relative">
                <select
                  value={selectedSportCategoryId || ''}
                  onChange={(e) => setSelectedSportCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={isLoadingCategories}
                  className="w-full appearance-none rounded-xl border border-surface-subtle bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  <option value="">{isLoadingCategories ? '로딩 중...' : '전체 대분류'}</option>
                  {sportCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* 소분류 필터 */}
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                종목 소분류
              </label>
              <div className="relative">
                <select
                  value={selectedSubSportCategoryId || ''}
                  onChange={(e) => setSelectedSubSportCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={!selectedSportCategoryId || subSportCategories.length === 0}
                  className="w-full appearance-none rounded-xl border border-surface-subtle bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedSportCategoryId 
                      ? '먼저 대분류를 선택해주세요' 
                      : subSportCategories.length === 0 
                      ? '소분류가 없습니다' 
                      : '전체 소분류'}
                  </option>
                  {subSportCategories.map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* 지역 필터 */}
            <div className="flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                지역
              </label>
              <div className="relative">
                <select
                  value={selectedRegion || ''}
                  onChange={(e) => setSelectedRegion(e.target.value || null)}
                  className="w-full appearance-none rounded-xl border border-surface-subtle bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="">전체 지역</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.shortName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* 필터 초기화 */}
            {(selectedSportCategoryId || selectedSubSportCategoryId || selectedRegion) && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSportCategoryId(null)
                    setSelectedSubSportCategoryId(null)
                    setSelectedRegion(null)
                  }}
                  className="rounded-xl border border-surface-subtle bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 추천 모드 안내 배너 */}
        {sortBy === 'recommended' && isAuthenticated && user?.interests && user.interests.length > 0 && (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-violet-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">맞춤 추천 모드</h3>
                <p className="mt-1 text-xs text-slate-600">
                  회원님의 관심 종목({(user.interests as string[]).join(', ')})을 바탕으로 추천합니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 결과 개수 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            총 <span className="font-semibold text-brand-primary">{filteredAndSortedEvents.length}</span>개의 행사
          </p>
          {(selectedSportCategoryId || selectedSubSportCategoryId || selectedRegion) && (
            <div className="flex items-center gap-2 text-sm">
              {selectedSportCategoryId && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  {sportCategories.find((c) => c.id === selectedSportCategoryId)?.name}
                </span>
              )}
              {selectedSubSportCategoryId && (
                <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                  {subSportCategories.find((s) => s.id === selectedSubSportCategoryId)?.name}
                </span>
              )}
              {selectedRegion && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {regions.find((r) => r.id === selectedRegion)?.shortName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 행사 목록 */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
          <EventList
            events={filteredAndSortedEvents}
            layout={layoutMode}
            columns={layoutMode === 'grid' ? 3 : 2}
            cardVariant={layoutMode === 'grid' ? 'default' : 'compact'}
            emptyMessage="조건에 맞는 행사가 없습니다."
            detailHrefBase="/events/"
          />
        </div>
      </div>
    </div>
  )
}

