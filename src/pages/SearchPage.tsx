import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Calendar, Search, X } from 'lucide-react'
import { useEventContext } from '../context/useEventContext'
import type { Category, Event } from '../types/events'
import { formatDate } from '../utils/formatDate'
import { CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../utils/categoryLabels'
import '../types/kakao.d.ts'

type CategoryFilter = 'all' | Category

// 지역별 중심 좌표 (카카오맵 기준)
const REGION_COORDINATES: Record<string, { lat: number; lng: number; level: number }> = {
  seoul: { lat: 37.5665, lng: 126.9780, level: 8 },
  busan: { lat: 35.1796, lng: 129.0756, level: 8 },
  daegu: { lat: 35.8714, lng: 128.6014, level: 8 },
  incheon: { lat: 37.4563, lng: 126.7052, level: 8 },
  gwangju: { lat: 35.1595, lng: 126.8526, level: 8 },
  daejeon: { lat: 36.3504, lng: 127.3845, level: 8 },
  ulsan: { lat: 35.5384, lng: 129.3114, level: 8 },
  sejong: { lat: 36.4800, lng: 127.2890, level: 8 },
  gyeonggi: { lat: 37.4138, lng: 127.5183, level: 10 },
  gangwon: { lat: 37.8228, lng: 128.1555, level: 10 },
  chungbuk: { lat: 36.6357, lng: 127.4914, level: 9 },
  chungnam: { lat: 36.5184, lng: 126.8000, level: 9 },
  jeonbuk: { lat: 35.7175, lng: 127.1530, level: 9 },
  jeonnam: { lat: 34.8161, lng: 126.4629, level: 9 },
  gyeongbuk: { lat: 36.4919, lng: 128.8889, level: 10 },
  gyeongnam: { lat: 35.4606, lng: 128.2132, level: 9 },
  jeju: { lat: 33.4890, lng: 126.4983, level: 9 },
}

// 스포츠 카테고리 정보
const SPORT_CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'team-ball', label: '구기·팀', emoji: '⚽' },
  { value: 'racket-ball', label: '라켓·볼', emoji: '🏓' },
  { value: 'martial-arts', label: '무도·격투', emoji: '🥋' },
  { value: 'fitness-skill', label: '체력·기술', emoji: '🏋️' },
  { value: 'precision', label: '정밀·기술', emoji: '🎯' },
  { value: 'ice-snow', label: '빙상·설원', emoji: '⛷️' },
  { value: 'water', label: '수상·해양', emoji: '🏊' },
  { value: 'leisure', label: '레저·환경', emoji: '🚴' },
  { value: 'mind', label: '마인드', emoji: '🧠' },
  { value: 'other', label: '기타', emoji: '🎮' },
]

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: '전체',
  ...CATEGORY_LABEL_MAP,
}

const Tag = ({ label }: { label: string }) => (
  <span className="inline-block rounded-full border border-surface-subtle bg-white px-2 py-0.5 text-xs text-slate-600">
    {label}
  </span>
)

export function SearchPage() {
  // EventContext에서 상태와 디스패치 가져오기
  const { state, dispatch, isLoading } = useEventContext()
  const { events } = state

  // 카카오맵 관련 ref
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infowindowRef = useRef<any>(null) // 공유 InfoWindow
  const currentMarkerRef = useRef<any>(null) // 현재 열려있는 마커

  const [selectedCity, setSelectedCity] = useState<string | null>(null)

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = (state?.selectedCategory ?? 'all') as CategoryFilter
  const initialKeyword = state?.keyword ?? ''

  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
  const [searchTerm, setSearchTerm] = useState(initialKeyword)

  // 카카오맵 초기화
  useEffect(() => {
    if (!mapContainerRef.current || !window.kakao?.maps) return

    const container = mapContainerRef.current
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.8), // 대한민국 중심 (제주 포함)
      level: 12, // 대한민국 전체가 보이는 레벨
    }

    const map = new window.kakao.maps.Map(container, options)
    mapRef.current = map

    // 지도 타입 컨트롤 및 줌 컨트롤 제거
    map.setZoomable(true) // 줌은 가능하게
    map.setDraggable(true) // 드래그 가능하게

    // 마커 클러스터러는 사용하지 않음 (개별 마커만 표시)

    // 지도 레벨 제한 (대한민국만 보이도록)
    map.setMinLevel(8) // 최대 확대 레벨 (숫자가 작을수록 확대)
    map.setMaxLevel(13) // 최대 축소 레벨 (대한민국 전체가 보이는 정도)

    // 지도 이동 시 범위 체크
    window.kakao.maps.event.addListener(map, 'dragend', () => {
      const center = map.getCenter()
      const lat = center.getLat()
      const lng = center.getLng()

      // 범위를 벗어나면 다시 범위 안으로 이동
      let newLat = lat
      let newLng = lng

      if (lat < 33.0) newLat = 33.0
      if (lat > 38.9) newLat = 38.9
      if (lng < 124.5) newLng = 124.5
      if (lng > 131.9) newLng = 131.9

      if (newLat !== lat || newLng !== lng) {
        map.setCenter(new window.kakao.maps.LatLng(newLat, newLng))
      }
    })

    // 줌 변경 시 범위 체크
    window.kakao.maps.event.addListener(map, 'zoom_changed', () => {
      const level = map.getLevel()
      if (level > 13) {
        map.setLevel(13)
      }
    })

    // 지도 클릭 시 InfoWindow 닫기
    window.kakao.maps.event.addListener(map, 'click', () => {
      if (infowindowRef.current) {
        infowindowRef.current.close()
        currentMarkerRef.current = null
      }
    })

    // 공유 InfoWindow 생성
    infowindowRef.current = new window.kakao.maps.InfoWindow({
      removable: false,
    })

    return () => {
      // 클린업 - 마커 제거
      markersRef.current.forEach(marker => marker.setMap(null))
      if (infowindowRef.current) {
        infowindowRef.current.close()
      }
    }
  }, [])

  // 지역 선택 시 지도 이동
  useEffect(() => {
    if (!mapRef.current || !selectedRegion) return

    const coords = REGION_COORDINATES[selectedRegion]
    if (coords) {
      const moveLatLon = new window.kakao.maps.LatLng(coords.lat, coords.lng)
      mapRef.current.setCenter(moveLatLon)
      mapRef.current.setLevel(coords.level)
    }
  }, [selectedRegion])

  const citiesByRegion = useMemo(() => {
    const map = new Map<string, Set<string>>()
    events.forEach((event) => {
      if (!map.has(event.region)) {
        map.set(event.region, new Set())
      }
      map.get(event.region)!.add(event.city)
    })
    return map
  }, [events])

  const citiesInRegion = useMemo(() => {
    if (!selectedRegion) return []
    return Array.from(citiesByRegion.get(selectedRegion) ?? []).sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
  }, [citiesByRegion, selectedRegion])

  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    // 새로운 스포츠 카테고리 목록 사용
    return ['all', ...SPORT_CATEGORIES.map(cat => cat.value)]
  }, [])

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return events
      .filter((event) => {
        const regionMatch = selectedRegion ? event.region === selectedRegion : true
        const cityMatch = selectedCity ? event.city === selectedCity : true
        const categoryMatch =
          categoryFilter === 'all' ? true : event.category === categoryFilter
        const keywordMatch = term
          ? [event.title, event.city, event.summary]
              .join(' ')
              .toLowerCase()
              .includes(term)
          : true
        return regionMatch && cityMatch && categoryMatch && keywordMatch
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [categoryFilter, events, searchTerm, selectedCity, selectedRegion])

  const handleEventSelect = useCallback((event: Event) => {
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: event.id })
  }, [dispatch])

  // 행사 마커 표시 함수
  useEffect(() => {
    console.log('[마커 표시] 시작', {
      mapExists: !!mapRef.current,
      kakaoMapsExists: !!window.kakao?.maps,
      filteredEventsCount: filteredEvents.length,
      filteredEvents: filteredEvents
    })

    if (!mapRef.current || !window.kakao?.maps) {
      console.log('[마커 표시] 지도 또는 카카오맵 API가 준비되지 않음')
      return
    }

    if (!filteredEvents.length) {
      console.log('[마커 표시] 필터링된 행사가 없음')
      return
    }

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    const geocoder = new window.kakao.maps.services.Geocoder()

    // 필터링된 행사들의 주소로 마커 생성
    filteredEvents.forEach((event) => {
      const address = event.address || event.venue
      console.log('[마커 생성 시도]', {
        title: event.title,
        address: address,
        venue: event.venue,
        region: event.region,
        city: event.city
      })

      if (!address) {
        console.log('[마커 생성 건너뜀] 주소 없음:', event.title)
        return
      }

      // 주소가 우편번호만 있거나 짧은 경우 지역+도시로 검색
      let searchQuery = address
      
      if (address.length < 10 || /^\d{5}$/.test(address)) {
        // 지역 ID를 한글 이름으로 변환
        const regionName = REGION_INFO[event.region]?.name || event.region
        searchQuery = `${regionName} ${event.city}`
      }

      console.log('[검색 쿼리]', searchQuery, '(원본 region:', event.region, ')')

      // 먼저 주소로 검색
      geocoder.addressSearch(searchQuery, (result: any[], status: string) => {
        console.log('[주소 검색 결과]', {
          query: searchQuery,
          status,
          resultCount: result?.length || 0,
          result: result
        })

        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x)
          
          // 마커 생성
          const marker = new window.kakao.maps.Marker({
            map: mapRef.current, // 지도에 바로 표시
            position: coords,
            title: event.title,
          })

          console.log('[마커 생성 완료]', {
            title: event.title,
            lat: result[0].y,
            lng: result[0].x
          })

          // 마커 클릭 이벤트 - 공유 InfoWindow 사용
          window.kakao.maps.event.addListener(marker, 'click', () => {
            // 같은 마커를 다시 클릭한 경우 토글 (닫기)
            if (currentMarkerRef.current === marker) {
              infowindowRef.current.close()
              currentMarkerRef.current = null
              return
            }
            
            // 다른 마커를 클릭한 경우 InfoWindow 내용 업데이트
            const content = `
              <div style="padding:10px;min-width:200px;">
                <a href="/events/${event.id}" style="font-weight:bold;margin-bottom:5px;color:#2563eb;text-decoration:none;display:block;cursor:pointer;">
                  ${event.title}
                </a>
                <div style="font-size:12px;color:#666;">
                  ${event.sport || ''}<br/>
                  ${event.venue || address}
                </div>
              </div>
            `
            infowindowRef.current.setContent(content)
            infowindowRef.current.open(mapRef.current, marker)
            currentMarkerRef.current = marker
            handleEventSelect(event)
          })

          markersRef.current.push(marker)
        } else {
          // 주소 검색 실패 시 장소 검색 시도
          console.log('[주소 검색 실패, 장소 검색 시도]', searchQuery)
          
          const places = new window.kakao.maps.services.Places()
          places.keywordSearch(searchQuery, (placeResult: any[], placeStatus: string) => {
            console.log('[장소 검색 결과]', {
              query: searchQuery,
              status: placeStatus,
              resultCount: placeResult?.length || 0
            })

            if (placeStatus === window.kakao.maps.services.Status.OK && placeResult.length > 0) {
              const coords = new window.kakao.maps.LatLng(placeResult[0].y, placeResult[0].x)
              
              // 마커 생성
              const marker = new window.kakao.maps.Marker({
                map: mapRef.current,
                position: coords,
                title: event.title,
              })

              console.log('[장소 검색으로 마커 생성 완료]', {
                title: event.title,
                lat: placeResult[0].y,
                lng: placeResult[0].x
              })

              // 마커 클릭 이벤트 - 공유 InfoWindow 사용
              window.kakao.maps.event.addListener(marker, 'click', () => {
                // 같은 마커를 다시 클릭한 경우 토글 (닫기)
                if (currentMarkerRef.current === marker) {
                  infowindowRef.current.close()
                  currentMarkerRef.current = null
                  return
                }
                
                // 다른 마커를 클릭한 경우 InfoWindow 내용 업데이트
                const content = `
                  <div style="padding:10px;min-width:200px;">
                    <a href="/events/${event.id}" style="font-weight:bold;margin-bottom:5px;color:#2563eb;text-decoration:none;display:block;cursor:pointer;">
                      ${event.title}
                    </a>
                    <div style="font-size:12px;color:#666;">
                      ${event.sport || ''}<br/>
                      ${event.venue || address}
                    </div>
                  </div>
                `
                infowindowRef.current.setContent(content)
                infowindowRef.current.open(mapRef.current, marker)
                currentMarkerRef.current = marker
                handleEventSelect(event)
              })

              markersRef.current.push(marker)
            } else {
              console.log('[마커 생성 최종 실패]', event.title, searchQuery)
            }
          })
        }
      })
    })
  }, [filteredEvents, handleEventSelect])

  useEffect(() => {
    setCategoryFilter(initialCategory)
  }, [initialCategory])

  useEffect(() => {
    setSearchTerm(initialKeyword)
  }, [initialKeyword])

  const resetFilters = () => {
    setSelectedRegion(null)
    setSelectedCity(null)
    setCategoryFilter('all')
    setSearchTerm('')
    dispatch({ type: 'CLEAR_FILTERS' })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
    
    // 지도를 대한민국 전체 보기로 복귀
    if (mapRef.current) {
      const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
      mapRef.current.setCenter(moveLatLon)
      mapRef.current.setLevel(12)
    }
  }

  const handleRegionClick = (regionId: string) => {
    // 빈 문자열이면 전체 보기 (초기화)
    if (regionId === '') {
      setSelectedRegion(null)
      setSelectedCity(null)
      dispatch({ type: 'SELECT_REGION', payload: null })
      dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
      
      // 지도를 대한민국 전체 보기로 복귀
      if (mapRef.current && window.kakao?.maps) {
        const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
        mapRef.current.setCenter(moveLatLon)
        mapRef.current.setLevel(12)
      }
      return
    }
    
    const nextRegion = regionId === selectedRegion ? null : regionId
    setSelectedRegion(nextRegion)
    setSelectedCity(null)

    if (state.selectedRegion !== nextRegion) {
      dispatch({ type: 'SELECT_REGION', payload: nextRegion })
    }
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })

    // 카카오맵 이동
    if (nextRegion && mapRef.current && window.kakao?.maps) {
      const coords = REGION_COORDINATES[nextRegion]
      if (coords) {
        const moveLatLon = new window.kakao.maps.LatLng(coords.lat, coords.lng)
        mapRef.current.setCenter(moveLatLon)
        mapRef.current.setLevel(coords.level)
      }
    } else if (mapRef.current && window.kakao?.maps) {
      // 지역 선택 해제 시 대한민국 전체 보기로 복귀
      const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
      mapRef.current.setCenter(moveLatLon)
      mapRef.current.setLevel(12)
    }
  }

  const handleCityClick = (city: string) => {
    setSelectedCity(city)
    setSearchTerm(city)
    dispatch({ type: 'SET_KEYWORD', payload: city })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
  }

  const handleCategoryChange = (option: CategoryFilter) => {
    setCategoryFilter(option)
    const nextCategory = option === 'all' ? null : option
    if (state.selectedCategory !== nextCategory) {
      dispatch({ type: 'SELECT_CATEGORY', payload: nextCategory })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (state.keyword !== value) {
      dispatch({ type: 'SET_KEYWORD', payload: value })
    }
  }

  // 지역별 간단한 정보
  const REGION_INFO: Record<string, { name: string; shortName: string; emoji: string }> = {
    seoul: { name: '서울특별시', shortName: '서울', emoji: '🏙️' },
    busan: { name: '부산광역시', shortName: '부산', emoji: '🌊' },
    daegu: { name: '대구광역시', shortName: '대구', emoji: '🏢' },
    incheon: { name: '인천광역시', shortName: '인천', emoji: '✈️' },
    gwangju: { name: '광주광역시', shortName: '광주', emoji: '🎨' },
    daejeon: { name: '대전광역시', shortName: '대전', emoji: '🔬' },
    ulsan: { name: '울산광역시', shortName: '울산', emoji: '🏭' },
    sejong: { name: '세종특별자치시', shortName: '세종', emoji: '🏛️' },
    gyeonggi: { name: '경기도', shortName: '경기', emoji: '🌆' },
    gangwon: { name: '강원도', shortName: '강원', emoji: '⛰️' },
    chungbuk: { name: '충청북도', shortName: '충북', emoji: '🏞️' },
    chungnam: { name: '충청남도', shortName: '충남', emoji: '🌾' },
    jeonbuk: { name: '전라북도', shortName: '전북', emoji: '🍚' },
    jeonnam: { name: '전라남도', shortName: '전남', emoji: '🌊' },
    gyeongbuk: { name: '경상북도', shortName: '경북', emoji: '🏔️' },
    gyeongnam: { name: '경상남도', shortName: '경남', emoji: '⚓' },
    jeju: { name: '제주특별자치도', shortName: '제주', emoji: '🏝️' },
  }


  return (
    <div className="space-y-16 pb-20">
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-10 text-white md:p-16">
        <div className="mx-auto flex max-w-content flex-col gap-7">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            sport contest search
          </span>
          <h1 className="text-3xl font-bold md:text-5xl">
            원하는 지역의 스포츠 행사를 지도에서 찾아보세요
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            도·광역시를 클릭해 세부 시·군·구 경계를 확인하고, 필터와 검색으로 관심 있는
            행사를 빠르게 찾을 수 있습니다.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            <span>• 지역을 선택하면 해당 지역이 확대되어 표시됩니다.</span>
            <span>• 시/군/구를 클릭하여 세부 필터링이 가능합니다.</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-content grid-cols-1 gap-6 px-4 md:grid-cols-[minmax(0,4.2fr)_minmax(320px,1.2fr)] lg:gap-10">
        <div className="relative flex flex-col gap-5 overflow-hidden">
          <div className="rounded-4xl border border-surface-subtle bg-white p-5 shadow-sm md:p-7 lg:p-8 overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                  대한민국 지역 지도
                </h2>
                <p className="text-sm text-slate-600">
                  {selectedRegion && REGION_INFO[selectedRegion]
                    ? `${REGION_INFO[selectedRegion].name} 선택됨`
                    : '지도를 탐색하고 원하는 위치를 검색해보세요.'}
                </p>
              </div>
              {(selectedRegion || selectedCity || searchTerm || categoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <X className="h-3 w-3" /> 초기화
                </button>
              )}
            </div>

            {/* 카카오맵 컨테이너 */}
            <div 
              ref={mapContainerRef}
              className="relative overflow-hidden rounded-4xl border border-surface-subtle"
              style={{ width: '100%', height: '600px' }}
            />

            {/* 지역 선택 버튼 그리드 */}
            <div className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {/* 전체 버튼 */}
              <button
                type="button"
                onClick={() => handleRegionClick('')}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                  !selectedRegion
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                <span className="text-xl">🇰🇷</span>
                <span className="text-xs font-medium">전체</span>
              </button>
              {Object.entries(REGION_INFO).map(([regionId, info]) => (
                <button
                  key={regionId}
                  type="button"
                  onClick={() => handleRegionClick(regionId)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                    selectedRegion === regionId
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  <span className="text-xl">{info.emoji}</span>
                  <span className="text-xs font-medium">{info.shortName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:gap-6">
          <div className="rounded-4xl border border-surface-subtle bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2 rounded-full border border-surface-subtle bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="도시 또는 행사명을 검색하세요"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              {(searchTerm ||
                categoryFilter !== 'all' ||
                selectedRegion ||
                selectedCity) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="whitespace-nowrap text-xs text-slate-500 transition hover:text-brand-primary"
                >
                  초기화
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {categoryOptions.map((option) => {
                const categoryInfo = option === 'all' 
                  ? { label: '전체', emoji: '🌐' }
                  : SPORT_CATEGORIES.find(cat => cat.value === option)
                
                return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleCategoryChange(option)}
                    className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs transition whitespace-nowrap ${
                    categoryFilter === option
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                    {categoryInfo?.emoji && <span className="text-sm flex-shrink-0">{categoryInfo.emoji}</span>}
                    <span>{categoryInfo?.label || CATEGORY_LABELS[option]}</span>
                </button>
                )
              })}
              {selectedRegion && (
                <Tag
                  label={`지역: ${REGION_INFO[selectedRegion]?.name?.replace(/특별자치도|특별자치시|특별시|광역시|도/g, '') ?? selectedRegion}`}
                />
              )}
              {selectedCity && <Tag label={`도시: ${selectedCity}`} />}
            </div>
          </div>

          <div className="rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">시/군/구</h2>
              {selectedRegion ? (
                <span className="text-xs text-slate-500">{citiesInRegion.length}곳</span>
              ) : (
                <span className="text-xs text-slate-500">도/광역시를 먼저 선택하세요</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRegion ? (
                citiesInRegion.length ? (
                  citiesInRegion.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleCityClick(city)}
                      className={`rounded-lg border px-2 py-1 text-xs transition ${
                        selectedCity === city
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {city}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    샘플 데이터에 도시 정보가 없습니다. 더 많은 Mock 데이터를 추가해 보세요.
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-500">지역을 선택하면 도시 목록이 표시됩니다.</p>
              )}
            </div>
          </div>

          <div className="rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-brand-primary" />
                행사 목록
              </h2>
              <span className="text-xs text-slate-500">{filteredEvents.length}건</span>
            </div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
                <p className="text-sm text-slate-500">행사를 불러오는 중...</p>
              </div>
            ) : (
            <ul className="flex flex-col divide-y divide-surface-subtle">
              {filteredEvents.length ? (
                filteredEvents.map((event) => {
                  const regionLabel = REGION_INFO[event.region]?.name?.replace(/특별자치도|특별자치시|특별시|광역시|도/g, '') ?? event.region
                  return (
                    <li key={event.id} className="py-3">
                      <div className="w-full text-left">
                        <div className="flex flex-col gap-1">
                          <a
                            href={`/events/${event.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-brand-primary transition-colors cursor-pointer"
                          >
                            {event.title}
                          </a>
                          <span className="text-xs text-slate-500">
                            {regionLabel} · {event.city} · {formatDate(event.date)}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <Tag label={CATEGORY_LABELS[event.category]} />
                          </div>
                          <p className="text-xs text-slate-500">{event.summary}</p>
                        </div>
                      </div>
                    </li>
                  )
                })
              ) : (
                <li className="py-6 text-center text-sm text-slate-500">
                  조건에 맞는 행사가 없습니다.
                </li>
              )}
            </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
