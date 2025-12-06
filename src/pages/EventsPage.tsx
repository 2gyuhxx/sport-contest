import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { EventCard } from '../components/EventCard/EventCard'
import { EventService, type SportCategory, type SubSportCategory, categoryToKoreanMap } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import type { Category, Event } from '../types/events'
import type { Favorite, RecommendedSportItem } from '../types/favorites'
import { getCategoryLabel } from '../utils/categoryLabels'
import { findSimilarUsers, recommendSportsFromSimilarUsers } from '../utils/cosineSimilarity'
import { filterEventsBySearch, sortEventsByDeadline, sortEventsByViews } from '../utils/eventSearch'
import { TrendingUp, Clock, Sparkles, Heart } from 'lucide-react'
import { useIsMobile } from '../hooks/useMediaQuery'
import { classNames } from '../utils/classNames'

type SortOption = 'latest' | 'popular' | 'recommended'

const SORT_OPTIONS = [
  { value: 'recommended' as const, label: '추천', icon: Sparkles, requiresAuth: true },
  { value: 'latest' as const, label: '마감일 순', icon: Clock },
  { value: 'popular' as const, label: '인기순', icon: TrendingUp },
]

// ✨ 상단에 스토리지 키 정의 (유지보수를 위해)
const STORAGE_KEY_PREFIX = 'EVENTS_PAGE_'

export function EventsPage() {
  const {
    state: { events },
    isLoading,
  } = useEventContext()
  
  const { state: authState } = useAuthContext()
  const { isAuthenticated, user } = authState

  const isMobile = useIsMobile()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') || ''

  // ✨ 수정 1: useState 초기화 시 sessionStorage 확인
  // 페이지에 돌아왔을 때 이전에 선택한 정렬 옵션을 기억합니다.
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}SORT`)
    return (saved as SortOption) || 'latest'
  })
  
  // URL이 완전히 초기화되었을 때 (홈 경로이고 쿼리 파라미터 없음) 상태 초기화
  useEffect(() => {
    const isHomePage = location.pathname === '/'
    const hasQueryParams = location.search.length > 0
    
    // ✨ 수정 2: '홈' 버튼 등을 눌러서 명시적으로 새로 진입했을 때만 초기화
    // (뒤로가기로 왔을 때는 location.key가 다르거나 동작 방식에 따라 이 로직을 탈 수 있으므로 주의)
    // 여기서는 사용자가 '명시적으로 초기화'를 원할 때 스토리지도 비워줍니다.
    if (isHomePage && !hasQueryParams) {
      // 만약 네비게이션 방식(POP vs PUSH)을 구분하기 어렵다면 
      // 이 부분은 유지하되, 아래의 스크롤 복원 로직이 우선순위를 갖도록 합니다.
      
      // 다만, 뒤로가기가 아니라 "로고 클릭" 등으로 왔을 때 완전 초기화를 원한다면:
      // sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SORT`)
      // sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}CAT`)
      // sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SUB_CAT`)
      // sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SCROLL`)
    }
  }, [location.pathname, location.search])
  
  // ✨ 수정 3: 카테고리 상태도 스토리지에서 복원
  // 대분류/소분류 상태
  const [sportCategories, setSportCategories] = useState<SportCategory[]>([])
  const [subSportCategories, setSubSportCategories] = useState<SubSportCategory[]>([])
  const [selectedSportCategoryId, setSelectedSportCategoryId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}CAT`)
    return saved ? Number(saved) : null
  })
  const [selectedSubSportCategoryId, setSelectedSubSportCategoryId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}SUB_CAT`)
    return saved ? Number(saved) : null
  })
  
  // 찜 기반 추천 상태
  const [myFavorites, setMyFavorites] = useState<Favorite[]>([])
  const [favoriteBasedEvents, setFavoriteBasedEvents] = useState<Event[]>([])
  const [recommendedSports, setRecommendedSports] = useState<string[]>([])

  // 그리드 컨테이너 ref (스크롤 위치 복원용)
  const eventsGridRef = useRef<HTMLDivElement>(null)
  const favoriteGridRef = useRef<HTMLDivElement>(null)

  // 대분류 카테고리 로드
  useEffect(() => {
    const loadSportCategories = async () => {
      try {
        const categories = await EventService.getSportCategoriesDB()
        setSportCategories(categories)
      } catch (err) {
        console.error('스포츠 카테고리 로드 오류:', err)
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
      } catch (err) {
        console.error('소분류 카테고리 로드 오류:', err)
      }
    }
    loadSubCategories()
  }, [selectedSportCategoryId])

  // 찜 목록 로드 (추천 기능용)
  useEffect(() => {
    const fetchFavorites = async () => {
      if (isAuthenticated && user?.id) {
        try {
          const favorites = await FavoriteService.getMyFavorites()
          setMyFavorites(favorites)
        } catch (error) {
          console.error('찜 목록 불러오기 실패:', error)
        }
      } else {
        setMyFavorites([])
      }
    }
    fetchFavorites()
  }, [isAuthenticated, user?.id])

  // 찜 기반 추천 행사 계산
  useEffect(() => {
    const loadRecommendations = async () => {
      if (sortBy === 'recommended' && isAuthenticated && user?.id && myFavorites.length > 0 && events.length > 0) {
        try {
          const myFavoriteSports = [
            ...new Set(
              myFavorites
                .map((fav) => fav.sub_sport)
                .filter((sub): sub is string => sub !== null)
            )
          ]
          
          if (myFavoriteSports.length > 0) {
            const { matrix, users, sports } = await FavoriteService.getUserSportMatrix()
            const similarUsers = findSimilarUsers(Number(user.id), matrix, users, sports, 5)
            const recommendedSportsList = recommendSportsFromSimilarUsers(
              similarUsers,
              matrix,
              sports,
              myFavoriteSports
            )
            
            const topRecommendedSports = recommendedSportsList.slice(0, 3).map((item: RecommendedSportItem) => item.sport)
            setRecommendedSports(topRecommendedSports)

            const allTargetSports = [...new Set([...myFavoriteSports, ...topRecommendedSports])]
            const filteredByRecommended = events.filter(event => {
              // 종료된 행사 제외
              if (event.event_status === 'inactive') return false
              // reports_state가 'normal'이 아닌 행사는 보이지 않게 필터링
              if (event.reports_state && event.reports_state !== 'normal') return false
              // 찜한 종목과 일치하는 행사만
              return allTargetSports.includes(event.sub_sport || '')
            })
            setFavoriteBasedEvents(filteredByRecommended)
          } else {
            setFavoriteBasedEvents([])
            setRecommendedSports([])
          }
        } catch (error) {
          console.error('추천 계산 오류:', error)
          setFavoriteBasedEvents([])
          setRecommendedSports([])
        }
      } else {
        setFavoriteBasedEvents([])
        setRecommendedSports([])
      }
    }
    loadRecommendations()
  }, [sortBy, isAuthenticated, user, myFavorites, events])

  // 필터링 및 정렬
  const filteredAndSortedEvents = useMemo(() => {
    // 종료된 행사 제외 및 신고 처리된 행사 제외
    let filtered = events.filter(event => {
      // 종료된 행사 제외
      if (event.event_status === 'inactive') return false
      // reports_state가 'normal'이 아닌 행사는 보이지 않게 필터링
      if (event.reports_state && event.reports_state !== 'normal') return false
      return true
    })

    // 추천 정렬일 때는 카테고리 필터를 무시하고 관심사 기반으로만 필터링
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
        // 대분류만 선택된 경우: event.category로 바로 필터링 (소분류 로드 기다리지 않음)
        const categoryFromKoreanName = Object.entries(categoryToKoreanMap).find(
          ([_, koreanName]) => koreanName === selectedCategory.name
        )?.[0] as Category | undefined
        
        if (categoryFromKoreanName) {
          // event.category로 바로 필터링
          filtered = filtered.filter((event) => event.category === categoryFromKoreanName)
        } else {
          // 매핑이 없으면 소분류 기반 필터링 시도
          if (subSportCategories.length > 0) {
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
              filtered = []
            }
          } else {
            filtered = []
          }
        }
      }
    }


    // 정렬
    switch (sortBy) {
      case 'recommended':
        // 추천 정렬: 사용자의 관심 카테고리를 기반으로 추천
        if (!user?.interests || user.interests.length === 0) {
          // 로그인하지 않았거나 관심사가 없으면 빈 배열 반환
          filtered = []
          break
        }
        
        const userInterests = user.interests as Category[]
        
        // 관심 카테고리와 일치하는 행사만 필터링 (event.category와 직접 비교)
        filtered = filtered.filter(event => userInterests.includes(event.category))
        
        // 검색어 필터링 (추천 모드에서도 검색어가 있으면 적용)
        if (searchQuery) {
          filtered = filterEventsBySearch(filtered, searchQuery)
        }
        
        // 마감일 순으로 정렬
        filtered = sortEventsByDeadline(filtered)
        break
        
      case 'latest':
        // 검색어 필터링
        if (searchQuery) {
          filtered = filterEventsBySearch(filtered, searchQuery)
        }
        
        // 마감일 순으로 정렬
        filtered = sortEventsByDeadline(filtered)
        break
        
      case 'popular':
        // 검색어 필터링
        if (searchQuery) {
          filtered = filterEventsBySearch(filtered, searchQuery)
        }
        
        // 조회수 순으로 정렬
        filtered = sortEventsByViews(filtered)
        break
    }

    return filtered
  }, [events, selectedSportCategoryId, selectedSubSportCategoryId, sortBy, user, subSportCategories, sportCategories, searchQuery])

  // ✨ 추가 4: 상태가 변경될 때마다 sessionStorage에 저장
  // 필터/정렬 변경 시 스크롤 위치 초기화를 위한 이전 값 추적
  const previousSortByRef = useRef<SortOption>(sortBy)
  const previousCategoryRef = useRef<number | null>(selectedSportCategoryId)
  const previousSubCategoryRef = useRef<number | null>(selectedSubSportCategoryId)
  const isInitialMountRef = useRef(true)
  
  useEffect(() => {
    // 초기 마운트 시에는 스크롤 복원을 위해 초기화하지 않음
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      previousSortByRef.current = sortBy
      previousCategoryRef.current = selectedSportCategoryId
      previousSubCategoryRef.current = selectedSubSportCategoryId
      
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SORT`, sortBy)
      if (selectedSportCategoryId) {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}CAT`, String(selectedSportCategoryId))
      } else {
        sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}CAT`)
      }
      
      if (selectedSubSportCategoryId) {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SUB_CAT`, String(selectedSubSportCategoryId))
      } else {
        sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SUB_CAT`)
      }
      return
    }
    
    // 정렬 또는 필터가 변경되었는지 확인
    const sortChanged = previousSortByRef.current !== sortBy
    const categoryChanged = previousCategoryRef.current !== selectedSportCategoryId
    const subCategoryChanged = previousSubCategoryRef.current !== selectedSubSportCategoryId
    
    // 필터/정렬이 변경되면 스크롤 위치 초기화
    if (sortChanged || categoryChanged || subCategoryChanged) {
      // 스크롤 위치 스토리지에서 삭제
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SCROLL`)
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}FAVORITE_SCROLL`)
      
      // 그리드 컨테이너 스크롤을 맨 위로 이동
      if (eventsGridRef.current) {
        eventsGridRef.current.scrollTop = 0
      }
      if (favoriteGridRef.current) {
        favoriteGridRef.current.scrollTop = 0
      }
      
      // 이전 값 업데이트
      previousSortByRef.current = sortBy
      previousCategoryRef.current = selectedSportCategoryId
      previousSubCategoryRef.current = selectedSubSportCategoryId
    }
    
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SORT`, sortBy)
    if (selectedSportCategoryId) {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}CAT`, String(selectedSportCategoryId))
    } else {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}CAT`)
    }
    
    if (selectedSubSportCategoryId) {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SUB_CAT`, String(selectedSubSportCategoryId))
    } else {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SUB_CAT`)
    }
  }, [sortBy, selectedSportCategoryId, selectedSubSportCategoryId])

  // ✨ 추가 5: 스크롤 위치 저장 및 복원 로직 (핵심)
  useEffect(() => {
    // 브라우저의 기본 스크롤 복원 기능 끄기 (충돌 방지)
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    
    // 페이지 스크롤도 0으로 유지 (그리드 컨테이너 스크롤만 사용)
    window.scrollTo(0, 0)
  }, [])

  // 그리드 스크롤 위치 저장 (실시간)
  useEffect(() => {
    if (location.pathname !== '/') return

    const eventsGrid = eventsGridRef.current
    const favoriteGrid = favoriteGridRef.current
    
    const handleEventsScroll = () => {
      if (eventsGrid && eventsGrid.scrollTop > 0) {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SCROLL`, eventsGrid.scrollTop.toString())
      }
    }
    
    const handleFavoriteScroll = () => {
      if (favoriteGrid && favoriteGrid.scrollTop > 0) {
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}FAVORITE_SCROLL`, favoriteGrid.scrollTop.toString())
      }
    }
    
    if (eventsGrid && filteredAndSortedEvents.length >= 8) {
      eventsGrid.addEventListener('scroll', handleEventsScroll, { passive: true })
    }
    
    if (favoriteGrid && favoriteBasedEvents.length >= 8) {
      favoriteGrid.addEventListener('scroll', handleFavoriteScroll, { passive: true })
    }
    
    return () => {
      if (eventsGrid) {
        eventsGrid.removeEventListener('scroll', handleEventsScroll)
        // 페이지를 떠날 때 최종 저장
        if (eventsGrid.scrollTop > 0) {
          sessionStorage.setItem(`${STORAGE_KEY_PREFIX}SCROLL`, eventsGrid.scrollTop.toString())
        }
      }
      if (favoriteGrid) {
        favoriteGrid.removeEventListener('scroll', handleFavoriteScroll)
        // 페이지를 떠날 때 최종 저장
        if (favoriteGrid.scrollTop > 0) {
          sessionStorage.setItem(`${STORAGE_KEY_PREFIX}FAVORITE_SCROLL`, favoriteGrid.scrollTop.toString())
        }
      }
    }
  }, [location.pathname, filteredAndSortedEvents.length, favoriteBasedEvents.length])

  // ✨ 추가 6: 데이터가 준비되었을 때 스크롤 복원 실행
  useEffect(() => {
    if (!isLoading && events.length > 0 && location.pathname === '/') {
      // 메인 그리드 스크롤 복원
      const savedScroll = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}SCROLL`)
      if (savedScroll && filteredAndSortedEvents.length >= 8) {
        const scrollTop = parseInt(savedScroll, 10)
        if (scrollTop > 0) {
          const restore = () => {
            const grid = eventsGridRef.current
            if (grid && grid.scrollHeight > scrollTop) {
              grid.scrollTop = scrollTop
            }
          }
          
          // 여러 시점에서 복원 시도
          requestAnimationFrame(restore)
          setTimeout(restore, 50)
          setTimeout(restore, 100)
          setTimeout(restore, 200)
          setTimeout(restore, 300)
          setTimeout(restore, 500)
          setTimeout(() => {
            restore()
            sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}SCROLL`)
          }, 700)
        }
      }
      
      // 찜 그리드 스크롤 복원
      const savedFavoriteScroll = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}FAVORITE_SCROLL`)
      if (savedFavoriteScroll && favoriteBasedEvents.length >= 8) {
        const scrollTop = parseInt(savedFavoriteScroll, 10)
        if (scrollTop > 0) {
          const restore = () => {
            const grid = favoriteGridRef.current
            if (grid && grid.scrollHeight > scrollTop) {
              grid.scrollTop = scrollTop
            }
          }
          
          // 여러 시점에서 복원 시도
          requestAnimationFrame(restore)
          setTimeout(restore, 50)
          setTimeout(restore, 100)
          setTimeout(restore, 200)
          setTimeout(restore, 300)
          setTimeout(restore, 500)
          setTimeout(() => {
            restore()
            sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}FAVORITE_SCROLL`)
          }, 700)
        }
      }
    }
  }, [isLoading, events.length, filteredAndSortedEvents.length, favoriteBasedEvents.length, location.pathname])

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent"></div>
          <p className="text-gray-600">행사 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 카테고리 이모지 맵
  const categoryEmojiMap: Record<string, string> = {
    '전체': '🌐',
    '구기·팀': '⚽',
    '라켓·볼': '🏓',
    '레저·환경': '🚴',
    '마인드': '🧠',
    '무도·격투': '🥋',
    '빙상·설원': '⛷️',
    '수상·해양': '🏊',
    '정밀·기술': '🎯',
    '체력·기술': '🏋️',
    '기타': '🎮',
  }

  return (
    <div className="pb-12">
      <div className={`mx-auto max-w-content px-2 sm:px-4 md:px-6 ${isMobile ? 'mt-2' : ''}`}>
        {/* 모바일 추천 빠른 접근 배너 */}
        {isMobile && isAuthenticated && favoriteBasedEvents.length > 0 && sortBy !== 'recommended' && (
          <div className="mb-2.5 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-2.5 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-amber-600" fill="currentColor" />
                  <h3 className="text-sm font-bold text-slate-900">나를 위한 맞춤 추천</h3>
                </div>
                <p className="text-xs text-slate-600">
                  {favoriteBasedEvents.length}개의 추천 행사를 확인하세요!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSortBy('recommended')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-amber-600 active:scale-95"
              >
                보기 <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* 종목 카테고리 섹션 */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">종목 카테고리</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {/* 전체 */}
            <button
              onClick={() => {
                // 추천 모드일 때 전체 선택 시 자동으로 마감일 순 정렬로 변경
                if (sortBy === 'recommended') {
                  setSortBy('latest')
                }
                setSelectedSportCategoryId(null)
                setSelectedSubSportCategoryId(null)
              }}
              className={classNames(
                'flex items-center gap-2 px-5 py-3 rounded-full font-medium text-sm transition-all flex-shrink-0',
                !selectedSportCategoryId
                  ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                  : 'bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5'
              )}
            >
              <span className="text-lg">{categoryEmojiMap['전체']}</span>
              <span>전체</span>
            </button>
            
            {/* 스포츠 카테고리 Chips */}
            {sportCategories.map((category) => {
              const emoji = categoryEmojiMap[category.name] || '🏃'
              
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    // 추천 모드일 때 카테고리 선택 시 자동으로 마감일 순 정렬로 변경
                    if (sortBy === 'recommended') {
                      setSortBy('latest')
                    }
                    setSelectedSportCategoryId(category.id)
                    setSelectedSubSportCategoryId(null)
                  }}
                  className={classNames(
                    'flex items-center gap-2 px-5 py-3 rounded-full font-medium text-sm transition-all flex-shrink-0',
                    selectedSportCategoryId === category.id
                      ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                      : 'bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5'
                  )}
                >
                  <span className="text-lg">{emoji}</span>
                  <span>{category.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 정렬 옵션 섹션 */}
        <div className="mb-12">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">정렬 옵션</h3>
          <div className="flex gap-3 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
            {SORT_OPTIONS.map((option) => {
              // '추천' 옵션은 로그인 상태일 때만 표시
              if (option.requiresAuth && !isAuthenticated) {
                return null
              }
              return (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={classNames(
                    'flex items-center gap-2 px-5 py-3 rounded-full font-medium text-sm transition-all flex-shrink-0',
                    sortBy === option.value
                      ? 'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                      : 'bg-white text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:-translate-y-0.5'
                  )}
                >
                  {option.icon && <option.icon className="h-4 w-4" />}
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 결과 개수 - 미니멀 스타일 */}
        <div className="mb-8">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#2563EB]">{filteredAndSortedEvents.length}</span>개의 행사
          </p>
        </div>
        
        {/* 추천 모드 안내 배너 */}
        {sortBy === 'recommended' && isAuthenticated && user && user.interests && user.interests.length > 0 && (
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

        {/* Masonry/Bento Grid 레이아웃 */}
        {filteredAndSortedEvents.length === 0 ? (
          <div className="floating-card p-16 text-center">
            <p className="text-gray-500 text-lg">
              {isAuthenticated && sortBy === 'recommended'
                ? user && user.interests && user.interests.length > 0
                  ? '관심 종목과 일치하는 행사가 없습니다.'
                  : '관심 종목을 설정하면 맞춤 추천을 받을 수 있습니다.'
                : '조건에 맞는 행사가 없습니다.'}
            </p>
          </div>
        ) : (
          <div 
            ref={eventsGridRef}
            className={classNames(
              filteredAndSortedEvents.length >= 8 && "max-h-[850px] overflow-y-auto recommended-scroll"
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedEvents.map((event) => {
                // 모든 카드를 텍스트 오버레이 스타일(featured)로 표시
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    variant="featured"
                    detailHref={`/events/${event.id}`}
                  />
                )
              })}
            </div>
          </div>
        )}

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
                총 <span className="font-semibold text-[#2563EB]">{favoriteBasedEvents.length}</span>개의 행사
              </p>
            </div>

            {/* 찜 기반 추천 행사 목록 - Masonry Grid */}
            {favoriteBasedEvents.length === 0 ? (
              <div className="floating-card p-12 text-center">
                <p className="text-gray-500">찜한 종목과 일치하는 새로운 행사가 없습니다.</p>
              </div>
            ) : (
              <div 
                ref={favoriteGridRef}
                className={classNames(
                  favoriteBasedEvents.length >= 8 && "max-h-[850px] overflow-y-auto recommended-scroll"
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {favoriteBasedEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      variant="featured" // 모든 카드를 featured variant로 설정
                      detailHref={`/events/${event.id}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
