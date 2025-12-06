import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Category, Event } from '../types/events'
import { SPORT_CATEGORIES, REGION_INFO } from '../constants'
import { FavoriteService } from '../services/FavoriteService'
import { findSimilarUsers, recommendSportsFromSimilarUsers } from '../utils/cosineSimilarity'
import { filterEventsBySearch } from '../utils/eventSearch'
import type { RecommendedSportItem } from '../types/favorites'

export type CategoryFilter = 'all' | Category

interface UseEventFiltersProps {
    events: Event[]
    isAuthenticated: boolean
    userId?: number | string
    userInterests?: Category[]
    initialRegion?: string | null
    initialCategory?: CategoryFilter
    initialKeyword?: string
}

interface UseEventFiltersReturn {
    selectedRegion: string | null
    setSelectedRegion: (region: string | null) => void
    selectedCity: string | null
    setSelectedCity: (city: string | null) => void
    categoryFilter: CategoryFilter
    setCategoryFilter: (category: CategoryFilter) => void
    searchTerm: string
    setSearchTerm: (term: string) => void
    filteredEvents: Event[]
    filteredEventsCount: number
    recommendedEvents: Event[]
    categoryOptions: CategoryFilter[]
    handleCategoryChange: (category: CategoryFilter) => void
    resetFilters: () => void
}

export function useEventFilters({
    events,
    isAuthenticated,
    userId,
    userInterests,
    initialRegion = null,
    initialCategory = 'all',
    initialKeyword = ''
}: UseEventFiltersProps): UseEventFiltersReturn {

    const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
    const [selectedCity, setSelectedCity] = useState<string | null>(null)
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
    const [searchTerm, setSearchTerm] = useState(initialKeyword)
    const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])

    // 맞춤 추천 로드 (관심 종목 + 찜 기반 추천)
    useEffect(() => {
        const loadRecommendations = async () => {
            if (!isAuthenticated || !userId || events.length === 0) {
                setRecommendedEvents([])
                return
            }

            try {
                // 활성 이벤트 필터링 (기본 조건)
                const activeEvents = events.filter(event => {
                    const isActive = event.event_status !== 'inactive'
                    const isNormal = !event.reports_state || event.reports_state === 'normal'
                    return isActive && isNormal
                })

                // 1. 맞춤 추천: 사용자의 관심 종목(userInterests) 기반
                const interests = userInterests || []
                const interestBasedEvents: Event[] = []

                if (interests.length > 0) {
                    // 관심 카테고리와 일치하는 행사만 필터링
                    interestBasedEvents.push(...activeEvents.filter(event => {
                        return interests.includes(event.category)
                    }))
                }

                // 2. 찜 추천: 찜한 종목 + 유사한 사용자들이 찜한 종목 기반
                const favoriteBasedEvents: Event[] = []

                try {
                    const myFavorites = await FavoriteService.getMyFavorites()

                    if (myFavorites.length > 0) {
                        // 찜한 종목 추출
                        const myFavoriteSports = [
                            ...new Set(
                                myFavorites
                                    .map((fav) => fav.sub_sport)
                                    .filter((sub): sub is string => sub !== null)
                            )
                        ]

                        if (myFavoriteSports.length > 0) {
                            try {
                                // 사용자-종목 선호도 행렬 가져오기
                                const { matrix, users, sports } = await FavoriteService.getUserSportMatrix()

                                // 유사한 사용자 찾기
                                const similarUsers = findSimilarUsers(Number(userId), matrix, users, sports, 5)

                                // 유사한 사용자들이 찜한 종목 추천
                                const recommendedSportsList = recommendSportsFromSimilarUsers(
                                    similarUsers,
                                    matrix,
                                    sports,
                                    myFavoriteSports
                                )

                                // 상위 3개 추천 종목 선택
                                const topRecommendedSports = recommendedSportsList.slice(0, 3).map((item: RecommendedSportItem) => item.sport)

                                // 찜한 종목 + 추천 종목 모두 포함
                                const allTargetSports = [...new Set([...myFavoriteSports, ...topRecommendedSports])]

                                // 해당 종목의 활성 이벤트 필터링
                                favoriteBasedEvents.push(...activeEvents.filter(event => {
                                    return allTargetSports.includes(event.sub_sport || '')
                                }))
                            } catch (matrixError) {
                                // 행렬 조회 실패 시 찜한 종목만으로 필터링
                                favoriteBasedEvents.push(...activeEvents.filter(event => {
                                    return myFavoriteSports.includes(event.sub_sport || '')
                                }))
                            }
                        }
                    }
                } catch (favoriteError) {
                    // 찜 목록 조회 실패 시 조용히 무시 (403 에러 등)
                    if (import.meta.env.DEV) {
                        console.debug('찜 목록 조회 실패 (정상 동작일 수 있음):', favoriteError)
                    }
                }

                // 맞춤 추천 + 찜 추천 합치기 (중복 제거)
                const allRecommendedEvents = [
                    ...interestBasedEvents,
                    ...favoriteBasedEvents
                ]

                // 중복 제거 (같은 event.id는 하나만)
                const uniqueRecommendedEvents = Array.from(
                    new Map(allRecommendedEvents.map(event => [event.id, event])).values()
                )

                setRecommendedEvents(uniqueRecommendedEvents)
            } catch (error) {
                console.error('추천 계산 오류:', error)
                // 오류 발생 시 활성 이벤트 중에서 랜덤으로 추천
                const activeEvents = events.filter(event => {
                    const isActive = event.event_status !== 'inactive'
                    const isNormal = !event.reports_state || event.reports_state === 'normal'
                    return isActive && isNormal
                })
                const shuffled = [...activeEvents].sort(() => Math.random() - 0.5)
                setRecommendedEvents(shuffled)
            }
        }

        loadRecommendations()
    }, [isAuthenticated, userId, userInterests, events])

    // 카테고리 옵션
    const categoryOptions = useMemo<CategoryFilter[]>(() => {
        return ['all', ...SPORT_CATEGORIES.map(cat => cat.value)]
    }, [])

    // 필터링된 이벤트 (전체 개수 계산용)
    const allFilteredEvents = useMemo(() => {
        // 1. 기본 필터: 활성 상태 + 신고 상태
        let filtered = events.filter((event) => {
            const isActive = event.event_status !== 'inactive'
            const isNormal = !event.reports_state || event.reports_state === 'normal'
            return isActive && isNormal
        })

        // 2. 지역 필터
        if (selectedRegion) {
            filtered = filtered.filter(event => event.region === selectedRegion)
        }

        // 3. 도시 필터
        if (selectedCity) {
            filtered = filtered.filter(event => event.city === selectedCity)
        }

        // 4. 카테고리 필터
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(event => event.category === categoryFilter)
        }

        // 5. 검색어 필터 (EventsPage와 동일한 함수 사용)
        if (searchTerm.trim()) {
            filtered = filterEventsBySearch(filtered, searchTerm)
        }

        return filtered
    }, [events, selectedRegion, selectedCity, categoryFilter, searchTerm])

    // 필터링된 이벤트 (표시용, 최대 50개)
    const filteredEvents = useMemo(() => {
        return allFilteredEvents.slice(0, 50)
    }, [allFilteredEvents])

    // 전체 필터링된 이벤트 개수
    const filteredEventsCount = useMemo(() => {
        return allFilteredEvents.length
    }, [allFilteredEvents])

    // 카테고리 변경 핸들러
    const handleCategoryChange = useCallback((category: CategoryFilter) => {
        setCategoryFilter(category)
    }, [])

    // 필터 초기화
    const resetFilters = useCallback(() => {
        setSelectedRegion(null)
        setSelectedCity(null)
        setCategoryFilter('all')
        setSearchTerm('')
    }, [])

    return {
        selectedRegion,
        setSelectedRegion,
        selectedCity,
        setSelectedCity,
        categoryFilter,
        setCategoryFilter,
        searchTerm,
        setSearchTerm,
        filteredEvents,
        filteredEventsCount,
        recommendedEvents,
        categoryOptions,
        handleCategoryChange,
        resetFilters
    }
}
