import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { EventList } from '../components/EventList/EventList'
import { EventCard } from '../components/EventCard'
import { EventService, type SportCategory, type SubSportCategory } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import type { Category, Event } from '../types/events'
import { getCategoryLabel } from '../utils/categoryLabels'
import { findSimilarUsers, recommendSportsFromSimilarUsers } from '../utils/cosineSimilarity'
import { Filter, TrendingUp, Calendar, Clock, ChevronDown, Sparkles, Heart, ChevronLeft, ChevronRight } from 'lucide-react'

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
  
  // 찜 기반 추천 상태
  const [myFavorites, setMyFavorites] = useState<any[]>([])
  const [favoriteBasedEvents, setFavoriteBasedEvents] = useState<Event[]>([])
  const [recommendedSports, setRecommendedSports] = useState<string[]>([])

  // 캐러셀 ref
  const interestScrollRef = useRef<HTMLDivElement>(null)
  const favoriteScrollRef = useRef<HTMLDivElement>(null)

  // 캐러셀 스크롤 함수 (3개씩 이동)
  const scrollCarousel = useCallback((ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = ref.current.clientWidth
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }, [])

  // 캐러셀 스크롤 래퍼 함수들
  const scrollInterestLeft = useCallback(() => scrollCarousel(interestScrollRef, 'left'), [scrollCarousel])
  const scrollInterestRight = useCallback(() => scrollCarousel(interestScrollRef, 'right'), [scrollCarousel])
  const scrollFavoriteLeft = useCallback(() => scrollCarousel(favoriteScrollRef, 'left'), [scrollCarousel])
  const scrollFavoriteRight = useCallback(() => scrollCarousel(favoriteScrollRef, 'right'), [scrollCarousel])

  // 캐러셀 초기 위치 설정
  useEffect(() => {
    if (interestScrollRef.current) {
      interestScrollRef.current.scrollLeft = 0
    }
    if (favoriteScrollRef.current) {
      favoriteScrollRef.current.scrollLeft = 0
    }
  }, [sortBy])

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
        const subCategories = await EventService.getSubSportCategoriesById(selectedSportCategoryId)
        setSubSportCategories(subCategories)
        setSelectedSubSportCategoryId(null)
      } catch (err) {
        console.error('소분류 카테고리 로드 오류:', err)
        setSubSportCategories([])
      }
    }
    loadSubCategories()
  }, [selectedSportCategoryId])

  // 찜 목록 로드 및 코사인 유사도 기반 추천 (추천 모드일 때만)
  useEffect(() => {
    const loadFavoritesAndRecommend = async () => {
      console.log('[찜 추천] 조건 체크 - isAuthenticated:', isAuthenticated, 'sortBy:', sortBy)
      
      if (isAuthenticated && sortBy === 'recommended' && user) {
        try {
          console.log('[찜 추천] API 호출 시작...')
          
          // 1. 내 찜 목록 가져오기
          const favorites = await FavoriteService.getMyFavorites()
          console.log('[찜 추천] 받은 찜 목록:', favorites)
          setMyFavorites(favorites)
          
          // 2. 내가 찜한 소분류 목록
          const myFavoriteSports = [...new Set(
            favorites
              .map((fav: any) => fav.sub_sport)
              .filter((sub: string | null) => sub !== null)
          )]
          console.log('[찜 추천] 내가 찜한 소분류:', myFavoriteSports)
          
          // 3. 사용자-종목 행렬 가져오기
          const { matrix, users, sports } = await FavoriteService.getUserSportMatrix()
          console.log('[코사인 유사도] 행렬 로드 완료 - 사용자:', users.length, '종목:', sports.length)
          
          // 4. 나와 유사한 사용자 찾기
          const similarUsers = findSimilarUsers(Number(user.id), matrix, users, sports, 5)
          console.log('[코사인 유사도] 유사한 사용자:', similarUsers)
          
          // 5. 유사한 사용자들이 찜한 종목 추천
          const recommendedSportsList = recommendSportsFromSimilarUsers(
            similarUsers,
            matrix,
            sports,
            myFavoriteSports
          )
          console.log('[코사인 유사도] 추천 종목:', recommendedSportsList)
          
          // 6. 추천 종목 목록 저장
          const topRecommendedSports = recommendedSportsList.slice(0, 3).map(item => item.sport)
          setRecommendedSports(topRecommendedSports)
          
          // 7. 추천 종목 + 내가 찜한 종목의 행사 필터링
          const allTargetSports = [...new Set([...myFavoriteSports, ...topRecommendedSports])]
          console.log('[찜 추천] 최종 타겟 종목:', allTargetSports)
          
          const recommendedEvents = events.filter(event => {
            const isActive = event.event_status !== 'inactive'
            const hasSubSport = !!event.sub_sport
            const matchesSubSport = allTargetSports.includes(event.sub_sport || '')
            
            return isActive && hasSubSport && matchesSubSport
          })
          
          console.log('[찜 추천] 최종 추천 행사:', recommendedEvents.length, '개')
          setFavoriteBasedEvents(recommendedEvents)
        } catch (err) {
          console.error('찜 목록 로드 오류:', err)
          setMyFavorites([])
          setFavoriteBasedEvents([])
          setRecommendedSports([])
        }
      } else {
        console.log('[찜 추천] 조건 미충족으로 초기화')
        setMyFavorites([])
        setFavoriteBasedEvents([])
        setRecommendedSports([])
      }
    }
    loadFavoritesAndRecommend()
  }, [isAuthenticated, sortBy, events, user])

  // 필터링 및 정렬
  const filteredAndSortedEvents = useMemo(() => {
    // 종료된 행사 제외
    let filtered = events.filter(event => event.event_status !== 'inactive')

    // 추천 정렬일 때는 카테고리 필터를 무시 (사용자 관심사 기반으로만 필터링)
    const isRecommendedSort = sortBy === 'recommended'
    
    // 대분류 또는 소분류 카테고리 필터 (추천 정렬이 아닐 때만 적용)
    if (selectedSportCategoryId && !isRecommendedSort) {
      // 대분류가 선택된 경우
      const selectedCategory = sportCategories.find(cat => cat.id === selectedSportCategoryId)
      
      if (!selectedCategory) {
        // 대분류를 찾을 수 없으면 필터링하지 않음
        return filtered
      }

      if (selectedSubSportCategoryId) {
        // 소분류도 선택된 경우: 해당 소분류만 필터링
        const selectedSubCategory = subSportCategories.find(sub => sub.id === selectedSubSportCategoryId)
        if (selectedSubCategory) {
          filtered = filtered.filter((event) => 
            event.sub_sport === selectedSubCategory.name || 
            event.sport === selectedSubCategory.name
          )
        }
      } else {
        // 대분류만 선택된 경우: 해당 대분류에 속한 모든 소분류 필터링
        if (subSportCategories.length > 0) {
          // subSportCategories의 category_name이 선택된 대분류 이름과 일치하는지 확인
          const validSubCategories = subSportCategories.filter(
            sub => sub.category_name === selectedCategory.name
          )
          
          if (validSubCategories.length > 0) {
            const subCategoryNames = validSubCategories.map(sub => sub.name)
            filtered = filtered.filter((event) => 
              (event.sub_sport && subCategoryNames.includes(event.sub_sport)) ||
              (!event.sub_sport && event.sport && subCategoryNames.includes(event.sport))
            )
          } else {
            // category_name이 일치하는 소분류가 없으면 모든 행사 표시하지 않음
            filtered = []
          }
        } else {
          // 소분류가 없는 경우 (대분류에 소분류가 없음)
          filtered = []
        }
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
          const userInterests = user.interests as Category[]
          
          // 관심 카테고리와 일치하는 행사만 필터링 (event.category와 직접 비교)
          filtered = filtered.filter(event => {
            return userInterests.includes(event.category)
          })
          
          // 매칭된 행사들을 날짜 가중치 + 조회수로 정렬
          filtered.sort((a, b) => {
            const today = new Date().toISOString().split('T')[0]
            const aDateScore = a.date >= today ? 500 : 0
            const bDateScore = b.date >= today ? 500 : 0
            
            const aTotal = aDateScore + Math.log(a.views + 1) * 10
            const bTotal = bDateScore + Math.log(b.views + 1) * 10
            
            return bTotal - aTotal
          })
        } else {
          // 로그인하지 않았거나 관심사가 없으면 빈 배열 반환
          filtered = []
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
  }, [events, selectedSportCategoryId, selectedSubSportCategoryId, selectedRegion, sortBy, user, subSportCategories, sportCategories])

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
    <div className="space-y-16 pb-20">
      {/* 헤더 */}
      <header className="mx-auto max-w-content px-6 mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">all events</p>
        <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">행사</h1>
        <p className="mt-2 text-slate-600">
          전국의 다양한 체육 행사를 확인하고 참여하세요.
        </p>
      </header>
      
      <div className="mx-auto max-w-content px-6">

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

          {/* 필터 영역 - 추천 모드가 아닐 때만 표시 */}
          {sortBy !== 'recommended' && (
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
          )}
        </div>

        {/* 추천 모드 안내 배너 */}
        {sortBy === 'recommended' && isAuthenticated && user?.interests && user.interests.length > 0 && (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 flex-shrink-0 text-violet-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">맞춤 추천 모드</h3>
                <p className="mt-1 text-xs text-slate-600">
                  회원님의 관심 종목({(user.interests as Category[]).map(cat => getCategoryLabel(cat)).join(', ')})을 바탕으로 추천합니다
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
          {sortBy === 'recommended' && filteredAndSortedEvents.length > 4 ? (
            <div className="relative">
              {/* 왼쪽 화살표 */}
              <button
                onClick={scrollInterestLeft}
                className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg transition hover:bg-slate-50 border border-slate-200"
                aria-label="이전"
              >
                <ChevronLeft className="h-6 w-6 text-slate-700" />
              </button>

              {/* 스크롤 컨테이너 */}
              <div
                ref={interestScrollRef}
                className="overflow-x-hidden scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="flex gap-5 pb-4 transition-transform duration-300">
                  {filteredAndSortedEvents.map((event) => (
                    <div key={event.id} className="flex-shrink-0 w-[calc(33.333%-0.85rem)]">
                      <EventCard
                        event={event}
                        layout="vertical"
                        variant="default"
                        detailHref={`/events/${event.id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 오른쪽 화살표 */}
              <button
                onClick={scrollInterestRight}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-white p-3 shadow-lg transition hover:bg-slate-50 border border-slate-200"
                aria-label="다음"
              >
                <ChevronRight className="h-6 w-6 text-slate-700" />
              </button>
            </div>
          ) : (
            <EventList
              events={filteredAndSortedEvents}
              layout={layoutMode}
              columns={layoutMode === 'grid' ? 3 : 2}
              cardVariant={layoutMode === 'grid' ? 'default' : 'compact'}
              emptyMessage={
                sortBy === 'recommended' && isAuthenticated
                  ? user?.interests && user.interests.length > 0
                    ? '관심 종목과 일치하는 행사가 없습니다. 다른 종목을 관심사에 추가해보세요.'
                    : '관심 종목을 설정하면 맞춤 추천을 받을 수 있습니다.'
                  : '조건에 맞는 행사가 없습니다.'
              }
              detailHrefBase="/events/"
            />
          )}
        </div>

        {/* 찜 기반 추천 섹션 */}
        {sortBy === 'recommended' && isAuthenticated && myFavorites.length > 0 && (
          <div className="mt-8">
            {/* 찜 추천 모드 안내 배너 */}
            <div className="mb-4 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-4">
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">찜 추천 모드</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {recommendedSports.length > 0 ? (
                      <>
                        회원님의 찜 목록({[...new Set(myFavorites.map((fav: any) => fav.sub_sport).filter((s: string | null) => s !== null))].join(', ')})과 
                        유사한 사용자들이 찜한 종목({recommendedSports.join(', ')})을 바탕으로 추천합니다
                      </>
                    ) : (
                      <>
                        회원님의 찜 목록({[...new Set(myFavorites.map((fav: any) => fav.sub_sport).filter((s: string | null) => s !== null))].join(', ')})을 바탕으로 추천합니다
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 결과 개수 */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                총 <span className="font-semibold text-brand-primary">{favoriteBasedEvents.length}</span>개의 행사
              </p>
            </div>

            {/* 찜 기반 추천 행사 목록 */}
            <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
              {favoriteBasedEvents.length > 4 ? (
                <div className="relative">
                  {/* 왼쪽 화살표 */}
                  <button
                    onClick={scrollFavoriteLeft}
                    className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-3 shadow-lg transition hover:bg-slate-50 border border-slate-200"
                    aria-label="이전"
                  >
                    <ChevronLeft className="h-6 w-6 text-slate-700" />
                  </button>

                  {/* 스크롤 컨테이너 */}
                  <div
                    ref={favoriteScrollRef}
                    className="overflow-x-hidden scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <div className="flex gap-5 pb-4 transition-transform duration-300">
                      {favoriteBasedEvents.map((event) => (
                        <div key={event.id} className="flex-shrink-0 w-[calc(33.333%-0.85rem)]">
                          <EventCard
                            event={event}
                            layout="vertical"
                            variant="default"
                            detailHref={`/events/${event.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 오른쪽 화살표 */}
                  <button
                    onClick={scrollFavoriteRight}
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 rounded-full bg-white p-3 shadow-lg transition hover:bg-slate-50 border border-slate-200"
                    aria-label="다음"
                  >
                    <ChevronRight className="h-6 w-6 text-slate-700" />
                  </button>
                </div>
              ) : (
                <EventList
                  events={favoriteBasedEvents}
                  layout={layoutMode}
                  columns={layoutMode === 'grid' ? 3 : 2}
                  cardVariant={layoutMode === 'grid' ? 'default' : 'compact'}
                  emptyMessage="찜한 종목과 일치하는 새로운 행사가 없습니다."
                  detailHrefBase="/events/"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

