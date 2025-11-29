import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Calendar, X, ArrowLeft, Star } from 'lucide-react'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import type { Category, Event } from '../types/events'
import { formatDate } from '../utils/formatDate'
import { CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../utils/categoryLabels'
import { KOREA_REGION_PATHS } from '../data/koreaRegionPaths'
import { FavoriteService } from '../services/FavoriteService'
import { findSimilarUsers, recommendSportsFromSimilarUsers } from '../utils/cosineSimilarity'
import '../types/kakao.d.ts'

type CategoryFilter = 'all' | Category

// 지역별 중심 좌표 및 Polygon 경로 (카카오맵 기준)
const REGION_COORDINATES: Record<string, { lat: number; lng: number; level: number }> = {
  seoul: { lat: 37.5665, lng: 126.9780, level: 9 }, // 서울은 그대로 유지
  busan: { lat: 35.1796, lng: 129.0756, level: 10 }, // 9 → 10
  daegu: { lat: 35.8714, lng: 128.6014, level: 10 }, // 9 → 10
  incheon: { lat: 37.4563, lng: 126.7052, level: 10 }, // 9 → 10
  gwangju: { lat: 35.1595, lng: 126.8526, level: 10 }, // 9 → 10
  daejeon: { lat: 36.3504, lng: 127.3845, level: 10 }, // 9 → 10
  ulsan: { lat: 35.5384, lng: 129.3114, level: 10 }, // 9 → 10
  sejong: { lat: 36.4800, lng: 127.2890, level: 10 }, // 9 → 10
  gyeonggi: { lat: 37.4138, lng: 127.5183, level: 11}, // 11 → 12 (경기도 전체가 보이도록)
  gangwon: { lat: 37.8228, lng: 128.1555, level: 12 }, // 11 → 12 (강원도 전체가 보이도록)
  chungbuk: { lat: 36.6357, lng: 127.4914, level: 11 }, // 10 → 11 (충청북도 전체가 보이도록)
  chungnam: { lat: 36.5184, lng: 126.8000, level: 11 }, // 10 → 11 (충청남도 전체가 보이도록)
  jeonbuk: { lat: 35.7175, lng: 127.1530, level: 11 }, // 10 → 11 (전북 전체가 보이도록)
  jeonnam: { lat: 34.8161, lng: 126.4629, level: 11 }, // 10 → 11 (전남 전체가 보이도록)
  gyeongbuk: { lat: 36.4919, lng: 128.8889, level: 12 }, // 11 → 12 (경북 전체가 보이도록)
  gyeongnam: { lat: 35.4606, lng: 128.2132, level: 11 }, // 10 → 11 (경남 전체가 보이도록)
  jeju: { lat: 33.4890, lng: 126.4983, level: 10 }, // 9 → 10
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
  <span className="inline-block rounded-full border border-surface-subtle bg-white px-1.5 py-0.5 text-[10px] text-slate-600 md:px-2 md:text-xs">
    {label}
  </span>
)

export function SearchPage() {
  // EventContext에서 상태와 디스패치 가져오기
  const { state, dispatch, isLoading } = useEventContext()
  const { events } = state
  const { state: authState } = useAuthContext()
  const { user, isAuthenticated } = authState

  // 카카오맵 관련 ref
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infowindowRef = useRef<any>(null) // 공유 InfoWindow
  const currentMarkerRef = useRef<any>(null) // 현재 열려있는 마커
  
  // 시/군/구 경계선 ref
  const detailPolygonsRef = useRef<any[]>([])
  
  // 툴팁 상태 관리용 ref (클로저 문제 해결)
  const currentTooltipNameRef = useRef<string | null>(null)
  const mouseoutTimeoutRef = useRef<number | null>(null)
  const activePolygonNameRef = useRef<string | null>(null)

  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showDetailMap, setShowDetailMap] = useState(false)

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = (state?.selectedCategory ?? 'all') as CategoryFilter
  const initialKeyword = state?.keyword ?? ''

  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
  const [searchTerm, setSearchTerm] = useState(initialKeyword)
  
  // 맞춤 추천 관련 state
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])

  // Polygon과 CustomOverlay ref
  const polygonsRef = useRef<{ polygon: any; regionId: string }[]>([])
  const customOverlayRef = useRef<any>(null) // 시/도용 CustomOverlay
  const sigunguOverlayRef = useRef<any>(null) // 시/군/구용 CustomOverlay
  const koreaBoundsRef = useRef<any>(null) // 대한민국 경계 저장
  const [kakaoMapsLoaded, setKakaoMapsLoaded] = useState(false)

  // 카카오맵 SDK 로드 확인
  useEffect(() => {
    const checkKakaoMaps = () => {
      if (window.kakao?.maps) {
        setKakaoMapsLoaded(true)
      }
    }
    
    // 즉시 체크
    checkKakaoMaps()
    
    // 주기적으로 체크 (최대 5초)
    const interval = setInterval(() => {
      checkKakaoMaps()
      if (window.kakao?.maps) {
        clearInterval(interval)
      }
    }, 100)
    
    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, 5000)
    
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  // 카카오맵 초기화
  useEffect(() => {
    if (!mapContainerRef.current || !kakaoMapsLoaded) return
    
    // LatLng 생성자가 사용 가능한지 확인
    if (!window.kakao?.maps?.LatLng || typeof window.kakao.maps.LatLng !== 'function') {
      return
    }
    const container = mapContainerRef.current
    const options = {
      center: new window.kakao.maps.LatLng(36.5, 127.8), // 대한민국 중심 (제주 포함)
      level: 13, // 대한민국 전체가 보이는 레벨
    }

    const map = new window.kakao.maps.Map(container, options)
    mapRef.current = map

    // 지도 타입 컨트롤 및 줌 컨트롤 제거
    map.setZoomable(true) // 줌은 가능하게
    map.setDraggable(true) // 드래그 가능하게

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
      removable: true,
    })

    // CustomOverlay 생성 (시/도용)
    customOverlayRef.current = new window.kakao.maps.CustomOverlay({
      yAnchor: 1,
      zIndex: 1000, // 최상단에 표시
    })
    
    // CustomOverlay 생성 (시/군/구용)
    sigunguOverlayRef.current = new window.kakao.maps.CustomOverlay({
      yAnchor: 1,
      zIndex: 1000, // 최상단에 표시
    })

    // 대한민국 외 모든 지역 가리기 (바다, 북한, 주변국 포함)
    const overlayColor = '#f0f4f7'
    
    fetch('/korea-regions.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        // 대한민국 전체 경계선을 하나의 배열로 수집
        const koreaHoles: any[] = []
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
        
        geojson.features.forEach((feature: any) => {
          const geometry = feature.geometry
          if (geometry.type === 'MultiPolygon') {
            // MultiPolygon의 각 폴리곤마다 외곽선만 추출
            geometry.coordinates.forEach((polygon: any) => {
              const outerRing = polygon[0] // 첫 번째가 외곽선
              const hole = outerRing
                .filter((_: any, i: number) => i % 5 === 0) // 성능을 위해 간소화
                .map((coord: any) => {
                  // 경계 계산
                  if (coord[1] < minLat) minLat = coord[1]
                  if (coord[1] > maxLat) maxLat = coord[1]
                  if (coord[0] < minLng) minLng = coord[0]
                  if (coord[0] > maxLng) maxLng = coord[0]
                  return new window.kakao.maps.LatLng(coord[1], coord[0])
                })
              koreaHoles.push(hole)
            })
          } else if (geometry.type === 'Polygon') {
            const outerRing = geometry.coordinates[0]
            const hole = outerRing
              .filter((_: any, i: number) => i % 5 === 0)
              .map((coord: any) => {
                // 경계 계산
                if (coord[1] < minLat) minLat = coord[1]
                if (coord[1] > maxLat) maxLat = coord[1]
                if (coord[0] < minLng) minLng = coord[0]
                if (coord[0] > maxLng) maxLng = coord[0]
                return new window.kakao.maps.LatLng(coord[1], coord[0])
              })
            koreaHoles.push(hole)
          }
        })
        
        // 대한민국 영역의 경계로 지도 영역 제한 (양옆을 7%씩 자름)
        const latPadding = (maxLat - minLat) * 0.02  // 상하 2% 여유
        const lngWidth = maxLng - minLng
        
        const sw = new window.kakao.maps.LatLng(minLat - latPadding, minLng + lngWidth * 0.07) // 왼쪽 7% 자름
        const ne = new window.kakao.maps.LatLng(maxLat + latPadding, maxLng - lngWidth * 0.07) // 오른쪽 7% 자름
        const koreaBounds = new window.kakao.maps.LatLngBounds()
        koreaBounds.extend(sw)
        koreaBounds.extend(ne)
        
        // ref에 저장하여 나중에 재사용
        koreaBoundsRef.current = koreaBounds
        
        // 지도가 이 영역을 벗어나지 못하도록 설정
        map.setMaxLevel(13) // 최대 축소 레벨
        
        // 드래그 종료 시 영역 체크
        window.kakao.maps.event.addListener(map, 'dragend', () => {
          const bounds = map.getBounds()
          const mapSW = bounds.getSouthWest()
          const mapNE = bounds.getNorthEast()
          
          // 현재 보이는 영역이 대한민국 경계를 벗어났는지 체크
          if (!koreaBounds.contain(mapSW) || !koreaBounds.contain(mapNE)) {
            // 대한민국 경계 안으로 다시 이동
            map.setBounds(koreaBounds)
          }
        })
        
        // 초기에 대한민국 전체가 보이도록 설정
        map.setBounds(koreaBounds)
        
        // 전체를 덮는 큰 박스 (외부 경로) - 화면 전체를 완전히 덮도록 확장
        const outerBox = [
          new window.kakao.maps.LatLng(50.0, 120.0),  // 좌상단 (더 넓게)
          new window.kakao.maps.LatLng(50.0, 135.0),  // 우상단 (더 넓게)
          new window.kakao.maps.LatLng(30.0, 135.0),  // 우하단 (더 넓게)
          new window.kakao.maps.LatLng(30.0, 120.0),  // 좌하단 (더 넓게)
        ]
        
        // path: [외부박스, ...대한민국구멍들]
        const polygonPath = [outerBox, ...koreaHoles]
        
        new window.kakao.maps.Polygon({
          map: map,
          path: polygonPath,
          strokeWeight: 2,
          strokeColor: '#10b981',
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
          fillColor: overlayColor,
          fillOpacity: 1.0,
        })
        
      })
      .catch(error => console.error('GeoJSON 로드 실패:', error))

    // 지역별 Polygon 생성
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

    // 지역명을 regionId로 변환하는 헬퍼 함수
    const getRegionIdFromName = (name: string): string => {
      const nameToId: Record<string, string> = {
        '서울특별시': 'seoul',
        '부산광역시': 'busan',
        '대구광역시': 'daegu',
        '인천광역시': 'incheon',
        '광주광역시': 'gwangju',
        '대전광역시': 'daejeon',
        '울산광역시': 'ulsan',
        '세종특별자치시': 'sejong',
        '경기도': 'gyeonggi',
        '강원도': 'gangwon',
        '충청북도': 'chungbuk',
        '충청남도': 'chungnam',
        '전라북도': 'jeonbuk',
        '전라남도': 'jeonnam',
        '경상북도': 'gyeongbuk',
        '경상남도': 'gyeongnam',
        '제주특별자치도': 'jeju',
      }
      return nameToId[name] || ''
    }

    // Polygon 생성 함수
    const createPolygon = (regionId: string, polygonPath: any[]) => {
      const regionInfo = REGION_INFO[regionId]
      if (!regionInfo) return

      const polygon = new window.kakao.maps.Polygon({
        map: map,
        path: polygonPath,
        strokeWeight: 2,
        strokeColor: '#10b981',
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        fillColor: '#fff',
        fillOpacity: 0.05,
      })

      // 각 폴리곤에 원래 opacity와 strokeColor 저장
      ;(polygon as any)._originalOpacity = 0.05
      ;(polygon as any)._originalStrokeColor = '#10b981'
      
      // mouseover, mousemove, mouseout 이벤트 제거 (시/도는 hover 효과 없음)

      // click 이벤트 - 지역 확대 및 시/군/구 경계선 표시
      window.kakao.maps.event.addListener(polygon, 'click', function() {
        // InfoWindow와 CustomOverlay 닫기
        infowindowRef.current.close()
        customOverlayRef.current.setMap(null)
        
        // 클릭된 폴리곤의 스타일을 원래대로 복원
        polygon.setOptions({ fillColor: '#fff', fillOpacity: 0.05 })
        
        // 선택된 지역 설정
        setSelectedRegion(regionId)
        setShowDetailMap(true)
        dispatch({ type: 'SELECT_REGION', payload: regionId })
        
        // 메인 지도 해당 지역으로 이동 및 확대
        const coords = REGION_COORDINATES[regionId]
        if (coords && mapRef.current) {
          mapRef.current.setCenter(new window.kakao.maps.LatLng(coords.lat, coords.lng))
          mapRef.current.setLevel(coords.level)
        }
        
        // 선택된 지역은 숨기고, 나머지 지역들은 뿌옇게 표시하고 테두리를 흰색으로 변경
        polygonsRef.current.forEach(({ polygon: p, regionId: rid }) => {
          if (rid === regionId) {
            p.setMap(null) // 선택된 지역은 숨김
          } else {
            p.setMap(mapRef.current) // 다른 지역은 표시
            p.setOptions({ 
              fillColor: '#fff', 
              fillOpacity: 0.5, // 뿌옇게
              strokeColor: '#ffffff', // 테두리를 흰색으로
              strokeOpacity: 0.9
            })
            ;(p as any)._originalOpacity = 0.5 // 원래 opacity 업데이트
          }
        })
      })

      polygonsRef.current.push({ polygon, regionId })
    }

    // GeoJSON 로드 시도
    fetch('/korea-regions.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        geojson.features.forEach((feature: any) => {
          const regionName = feature.properties.name
          const regionId = getRegionIdFromName(regionName)
          if (!regionId) return

          const geometry = feature.geometry
          
          if (geometry.type === 'MultiPolygon') {
            // MultiPolygon의 모든 폴리곤 처리
            geometry.coordinates.forEach((polygon: any) => {
              // polygon[0]이 외곽선 좌표 배열
              const outerRing = polygon[0]
              // 성능을 위해 좌표 간소화 (10개 중 1개만 사용)
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 10 === 0)
              
              // [경도, 위도] -> LatLng(위도, 경도) 변환
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
                new window.kakao.maps.LatLng(coord[1], coord[0])
              )
              
              // 유효한 좌표가 있을 때만 폴리곤 생성
              if (polygonPath.length >= 3) {
                createPolygon(regionId, polygonPath)
              }
            })
          } else if (geometry.type === 'Polygon') {
            // 단일 Polygon 처리
            const outerRing = geometry.coordinates[0]
            const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 10 === 0)
            const polygonPath = simplifiedCoords.map((coord: number[]) => 
              new window.kakao.maps.LatLng(coord[1], coord[0])
            )
            
            if (polygonPath.length >= 3) {
              createPolygon(regionId, polygonPath)
            }
          }
        })
      })
      .catch(error => {
        console.error('GeoJSON 로드 실패, 기본 데이터 사용:', error)
        // Fallback: 기본 데이터 사용
        Object.entries(KOREA_REGION_PATHS).forEach(([regionId, path]) => {
          const polygonPath = path.map(coord => new window.kakao.maps.LatLng(coord.lat, coord.lng))
          createPolygon(regionId, polygonPath)
        })
      })

    return () => {
      // 클린업 - 마커 및 Polygon 제거
      markersRef.current.forEach(marker => marker.setMap(null))
      polygonsRef.current.forEach(({ polygon }) => polygon.setMap(null))
      if (infowindowRef.current) {
        infowindowRef.current.close()
      }
      if (customOverlayRef.current) {
        customOverlayRef.current.setMap(null)
      }
    }
  }, [kakaoMapsLoaded])

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

  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    // 새로운 스포츠 카테고리 목록 사용
    return ['all', ...SPORT_CATEGORIES.map(cat => cat.value)]
  }, [])

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return events
      .filter((event) => {
        // 종료된 행사 제외
        const isActive = event.event_status !== 'inactive'
        // reports_state가 'normal'이 아닌 행사는 보이지 않게 필터링
        const isNormal = !event.reports_state || event.reports_state === 'normal'
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
        return isActive && isNormal && regionMatch && cityMatch && categoryMatch && keywordMatch
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [categoryFilter, events, searchTerm, selectedCity, selectedRegion])

  // 맞춤 추천 로직 (관심사 기반 + 찜 기반)
  useEffect(() => {
    const loadRecommendations = async () => {
      if (isAuthenticated && user) {
        let interestBasedEvents: Event[] = []
        let favoriteBasedEvents: Event[] = []
        
        // 1. 관심사 기반 추천 (user.interests - 대분류 카테고리)
        if (user.interests && user.interests.length > 0) {
          const userInterests = user.interests as Category[]
          
          interestBasedEvents = filteredEvents.filter(event => {
            const isActive = event.event_status !== 'inactive'
            const isNormal = !event.reports_state || event.reports_state === 'normal'
            const matchesInterest = userInterests.includes(event.category)
            
            return isActive && isNormal && matchesInterest
          })
        }
        
        // 2. 찜 기반 추천 (소분류 + 코사인 유사도)
        try {
          const favorites = await FavoriteService.getMyFavorites()
          
          const myFavoriteSports = [
            ...new Set(
              favorites
                .map((fav: any) => fav.sub_sport)
                .filter((sub: string | null) => sub !== null)
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
            
            const topRecommendedSports = recommendedSportsList.slice(0, 3).map(item => item.sport)
            const allTargetSports = [...new Set([...myFavoriteSports, ...topRecommendedSports])]
            
            favoriteBasedEvents = filteredEvents.filter(event => {
              const isActive = event.event_status !== 'inactive'
              const hasSubSport = !!event.sub_sport
              const matchesSubSport = allTargetSports.includes(event.sub_sport || '')
              const isNormal = !event.reports_state || event.reports_state === 'normal'
              
              return isActive && hasSubSport && matchesSubSport && isNormal
            })
          }
        } catch (err: any) {
          // 인증 오류는 조용히 처리
          if (err?.status !== 403 && err?.status !== 401) {
            console.error('찜 목록 로드 오류:', err)
          }
        }
        
        // 3. 관심사 기반 + 찜 기반 행사를 합치고 중복 제거
        const allRecommended = [
          ...interestBasedEvents,
          ...favoriteBasedEvents
        ]
        
        // 중복 제거 (id 기준)
        const uniqueRecommended = Array.from(
          new Map(allRecommended.map(event => [event.id, event])).values()
        )
        
        // 마감일 순으로 정렬
        uniqueRecommended.sort((a, b) => {
          const deadlineA = a.registration_deadline || a.end_at || a.date
          const deadlineB = b.registration_deadline || b.end_at || b.date
          const dateA = new Date(deadlineA).getTime()
          const dateB = new Date(deadlineB).getTime()
          return dateA - dateB
        })
        
        setRecommendedEvents(uniqueRecommended)
      } else {
        setRecommendedEvents([])
      }
    }
    
    loadRecommendations()
  }, [isAuthenticated, user, filteredEvents])

  const handleEventSelect = useCallback((event: Event) => {
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: event.id })
  }, [dispatch])

  // 행사 마커 표시 함수 (도/광역시 선택 시에만 표시)
  useEffect(() => {
    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (!kakaoMapsLoaded || !mapRef.current || !window.kakao?.maps) {
      return
    }

    // 도/광역시가 선택되지 않았으면 마커 표시 안 함
    if (!selectedRegion) {
      return
    }

    if (!filteredEvents.length) {
      return
    }

    const geocoder = new window.kakao.maps.services.Geocoder()
    
    // 추천 이벤트 ID 세트 (빠른 조회용)
    const recommendedEventIds = new Set(recommendedEvents.map(e => e.id))
    
    // 마커 생성 헬퍼 함수
    const createMarker = (event: Event, coords: any) => {
      // 추천 이벤트인지 확인
      const isRecommended = recommendedEventIds.has(event.id)
      
      // 마커 옵션 설정
      const markerOptions: any = {
        map: mapRef.current,
        position: coords,
        title: event.title,
      }
      
      // 추천 이벤트면 노란색 마커 이미지 사용
      if (isRecommended) {
        const imageSize = new window.kakao.maps.Size(24, 35)
        const markerImage = new window.kakao.maps.MarkerImage(
          'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
          imageSize
        )
        markerOptions.image = markerImage
      }
      
      const marker = new window.kakao.maps.Marker(markerOptions)

      // 마커 클릭 이벤트
      window.kakao.maps.event.addListener(marker, 'click', () => {
        if (currentMarkerRef.current === marker) {
          infowindowRef.current.close()
          currentMarkerRef.current = null
          return
        }
        
        const recommendBadge = isRecommended 
          ? '<span style="display:inline-block;background:#fbbf24;color:white;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;margin-bottom:4px;">⭐ 추천</span><br/>'
          : ''
        
        const content = `
          <div style="padding:10px;min-width:200px;">
            ${recommendBadge}
            <a href="/events/${event.id}" style="font-weight:bold;margin-bottom:5px;color:#2563eb;text-decoration:none;display:block;cursor:pointer;">
              ${event.title}
            </a>
            <div style="font-size:12px;color:#666;">
              ${event.sport || ''}<br/>
              ${event.venue || event.address || ''}
            </div>
          </div>
        `
        infowindowRef.current.setContent(content)
        infowindowRef.current.open(mapRef.current, marker)
        currentMarkerRef.current = marker
        handleEventSelect(event)
      })

      markersRef.current.push(marker)
    }
    
    // 필터링된 행사들의 마커 생성
    filteredEvents.forEach((event) => {
      // 1순위: DB 좌표 사용
      if (event.lat && event.lng) {
        const coords = new window.kakao.maps.LatLng(event.lat, event.lng)
        createMarker(event, coords)
        return
      }

      // 2순위: Geocoding (DB에 좌표가 없는 경우만)
      const address = event.address || event.venue
      if (!address) {
        return
      }

      // 주소 정제
      let cleanAddress = address.replace(/\([^)]*\)/g, '').trim()
      let searchQuery = cleanAddress
      
      if (cleanAddress.length < 10 || /^\d{5}$/.test(cleanAddress)) {
        const regionName = REGION_INFO[event.region]?.name || event.region
        searchQuery = `${regionName} ${event.city}`
      }

      // 주소 검색
      geocoder.addressSearch(searchQuery, (result: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x)
          createMarker(event, coords)
        } else {
          // 장소 검색
          const places = new window.kakao.maps.services.Places()
          places.keywordSearch(searchQuery, (placeResult: any[], placeStatus: string) => {
            if (placeStatus === window.kakao.maps.services.Status.OK && placeResult.length > 0) {
              const coords = new window.kakao.maps.LatLng(placeResult[0].y, placeResult[0].x)
              createMarker(event, coords)
            }
          })
        }
      })
    })
  }, [filteredEvents, handleEventSelect, selectedRegion, kakaoMapsLoaded, recommendedEvents])

  useEffect(() => {
    setCategoryFilter(initialCategory)
  }, [initialCategory])

  useEffect(() => {
    setSearchTerm(initialKeyword)
  }, [initialKeyword])

  // 시/군/구 경계선 표시 (메인 지도에)
  useEffect(() => {
    if (!showDetailMap || !mapRef.current || !window.kakao?.maps || !selectedRegion) {
      return
    }

    // 이전 시/군/구 경계선 제거
    detailPolygonsRef.current.forEach(polygon => polygon.setMap(null))
    detailPolygonsRef.current = []
    
    // 상태 초기화
    currentTooltipNameRef.current = null
    if (mouseoutTimeoutRef.current) {
      clearTimeout(mouseoutTimeoutRef.current)
      mouseoutTimeoutRef.current = null
    }
    activePolygonNameRef.current = null
    
    // 같은 이름을 가진 polygon들을 그룹으로 관리 (지도 깜빡임 방지)
    const polygonGroups: Record<string, any[]> = {}

    // 시/군/구 GeoJSON 로드 및 필터링
    fetch('/korea-sigungu.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        const regionName = REGION_INFO[selectedRegion]?.name
        if (!regionName) return

        // 지역별 코드 매핑 (GeoJSON의 실제 코드 체계)
        const REGION_CODE_MAP: Record<string, string> = {
          'seoul': '11',
          'busan': '21',  // 부산 (16개 구/군)
          'daegu': '22',
          'incheon': '23',
          'gwangju': '24',
          'daejeon': '25',
          'ulsan': '26',  // 울산 (5개 구/군)
          'sejong': '29',
          'gyeonggi': '31',
          'gangwon': '32',
          'chungbuk': '33',
          'chungnam': '34',
          'jeonbuk': '35',
          'jeonnam': '36',
          'gyeongbuk': '37',
          'gyeongnam': '38',
          'jeju': '39',
        }
        
        // 해당 시/도에 속한 시/군/구만 필터링
        const regionCode = REGION_CODE_MAP[selectedRegion]
        let matchCount = 0
        
        geojson.features.forEach((feature: any) => {
          const sigunguName = feature.properties.name
          const sigunguCode = feature.properties.code || ''
          
          // 코드의 앞 2자리가 지역 코드와 일치하면 해당 지역
          const isMatch = sigunguCode.startsWith(regionCode)
          
          if (isMatch) {
            matchCount++
            const geometry = feature.geometry
            
            if (geometry.type === 'MultiPolygon') {
              geometry.coordinates.forEach((polygon: any) => {
                const outerRing = polygon[0]
                const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 5 === 0)
                
                const polygonPath = simplifiedCoords.map((coord: number[]) => 
                  new window.kakao.maps.LatLng(coord[1], coord[0])
                )
                
                if (polygonPath.length >= 3) {
                  const detailPolygon = new window.kakao.maps.Polygon({
                    map: mapRef.current, // 메인 지도에 그리기
                    path: polygonPath,
                    strokeWeight: 2,
                    strokeColor: '#10b981',
                    strokeOpacity: 0.9,
                    strokeStyle: 'solid',
                    fillColor: '#10b981',
                    fillOpacity: 0.05, // 매우 투명하게
                  })

                  // 같은 이름의 polygon 그룹에 추가
                  if (!polygonGroups[sigunguName]) {
                    polygonGroups[sigunguName] = []
                  }
                  polygonGroups[sigunguName].push(detailPolygon)

                  // mouseover 이벤트 - 툴팁 표시 및 스타일 변경
                  window.kakao.maps.event.addListener(detailPolygon, 'mouseover', function() {
                    // 기존 mouseout 타이머 취소
                    if (mouseoutTimeoutRef.current) {
                      clearTimeout(mouseoutTimeoutRef.current)
                      mouseoutTimeoutRef.current = null
                    }
                    
                    // 이미 같은 이름의 툴팁이 표시되어 있으면 건너뛰기
                    if (currentTooltipNameRef.current === sigunguName && sigunguOverlayRef.current) {
                      return
                    }
                    
                    // 다른 이름이 활성화되어 있으면 먼저 비활성화
                    if (activePolygonNameRef.current && activePolygonNameRef.current !== sigunguName && polygonGroups[activePolygonNameRef.current]) {
                      polygonGroups[activePolygonNameRef.current].forEach((poly: any) => {
                        poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                      })
                    }
                    
                    // 같은 이름의 모든 polygon의 스타일을 함께 변경
                    if (polygonGroups[sigunguName]) {
                      polygonGroups[sigunguName].forEach((poly: any) => {
                        poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.6 })
                      })
                    }
                    
                    activePolygonNameRef.current = sigunguName
                    
                    // CustomOverlay를 표시하고 내용 설정 (중앙 위치에 고정)
                    if (sigunguOverlayRef.current && mapRef.current) {
                      // 폴리곤의 중심점 계산
                      let centerLat = 0
                      let centerLng = 0
                      let pointCount = 0
                      
                      polygonPath.forEach((latlng: any) => {
                        centerLat += latlng.getLat()
                        centerLng += latlng.getLng()
                        pointCount++
                      })
                      
                      if (pointCount > 0) {
                        centerLat /= pointCount
                        centerLng /= pointCount
                        const centerPosition = new window.kakao.maps.LatLng(centerLat, centerLng)
                        
                        const content = `<div style="padding: 8px 12px; background: white; border: 1px solid #10b981; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; pointer-events: none;">${sigunguName}</div>`
                        sigunguOverlayRef.current.setContent(content)
                        sigunguOverlayRef.current.setPosition(centerPosition)
                        sigunguOverlayRef.current.setMap(mapRef.current)
                        currentTooltipNameRef.current = sigunguName
                      }
                    }
                  })

                  // mouseout 이벤트
                  window.kakao.maps.event.addListener(detailPolygon, 'mouseout', function() {
                    // 약간의 지연 후 색상 복원 및 툴팁 숨기기 (다른 polygon으로 빠르게 이동할 때 깜빡임 방지)
                    mouseoutTimeoutRef.current = setTimeout(() => {
                      // 같은 이름의 polygon이 여전히 활성화되어 있지 않으면 색상 복원
                      if (activePolygonNameRef.current === sigunguName) {
                        if (polygonGroups[sigunguName]) {
                          polygonGroups[sigunguName].forEach((poly: any) => {
                            poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                          })
                        }
                        activePolygonNameRef.current = null
                      }
                      
                      if (sigunguOverlayRef.current) {
                        sigunguOverlayRef.current.setMap(null)
                        currentTooltipNameRef.current = null
                      }
                      mouseoutTimeoutRef.current = null
                    }, 50) as unknown as number // 지연 시간을 줄여서 더 빠르게 반응
                  })

                  // click 이벤트 - 해당 시/군/구로 확대
                  window.kakao.maps.event.addListener(detailPolygon, 'click', function() {
                    // 선택된 시/군/구 저장 (오른쪽 위 라벨 업데이트)
                    setSelectedCity(sigunguName)
                    
                    // 폴리곤의 경계로 지도 확대
                    const bounds = new window.kakao.maps.LatLngBounds()
                    polygonPath.forEach((latlng: any) => bounds.extend(latlng))
                    mapRef.current.setBounds(bounds)
                  })

                  detailPolygonsRef.current.push(detailPolygon)
                }
              })
            } else if (geometry.type === 'Polygon') {
              const outerRing = geometry.coordinates[0]
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 5 === 0)
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
                new window.kakao.maps.LatLng(coord[1], coord[0])
              )
              
              if (polygonPath.length >= 3) {
                const detailPolygon = new window.kakao.maps.Polygon({
                  map: mapRef.current, // 메인 지도에 그리기
                  path: polygonPath,
                  strokeWeight: 2,
                  strokeColor: '#10b981',
                  strokeOpacity: 0.9,
                  strokeStyle: 'solid',
                  fillColor: '#10b981',
                  fillOpacity: 0.05, // 매우 투명하게
                })

                // 같은 이름의 polygon 그룹에 추가
                if (!polygonGroups[sigunguName]) {
                  polygonGroups[sigunguName] = []
                }
                polygonGroups[sigunguName].push(detailPolygon)

                // mouseover 이벤트 - 툴팁 표시 및 스타일 변경
                window.kakao.maps.event.addListener(detailPolygon, 'mouseover', function() {
                  // 기존 mouseout 타이머 취소
                  if (mouseoutTimeoutRef.current) {
                    clearTimeout(mouseoutTimeoutRef.current)
                    mouseoutTimeoutRef.current = null
                  }
                  
                  // 이미 같은 이름의 툴팁이 표시되어 있으면 건너뛰기
                  if (currentTooltipNameRef.current === sigunguName && sigunguOverlayRef.current) {
                    return
                  }
                  
                  // 다른 이름이 활성화되어 있으면 먼저 비활성화
                  if (activePolygonNameRef.current && activePolygonNameRef.current !== sigunguName && polygonGroups[activePolygonNameRef.current]) {
                    polygonGroups[activePolygonNameRef.current].forEach((poly: any) => {
                      poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                    })
                  }
                  
                  // 같은 이름의 모든 polygon의 스타일을 함께 변경
                  if (polygonGroups[sigunguName]) {
                    polygonGroups[sigunguName].forEach((poly: any) => {
                      poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.6 })
                    })
                  }
                  
                  activePolygonNameRef.current = sigunguName
                  
                  // CustomOverlay를 표시하고 내용 설정 (중앙 위치에 고정)
                  if (sigunguOverlayRef.current && mapRef.current) {
                    // 폴리곤의 중심점 계산
                    let centerLat = 0
                    let centerLng = 0
                    let pointCount = 0
                    
                    polygonPath.forEach((latlng: any) => {
                      centerLat += latlng.getLat()
                      centerLng += latlng.getLng()
                      pointCount++
                    })
                    
                    if (pointCount > 0) {
                      centerLat /= pointCount
                      centerLng /= pointCount
                      const centerPosition = new window.kakao.maps.LatLng(centerLat, centerLng)
                      
                      const content = `<div style="padding: 8px 12px; background: white; border: 1px solid #10b981; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; pointer-events: none;">${sigunguName}</div>`
                      sigunguOverlayRef.current.setContent(content)
                      sigunguOverlayRef.current.setPosition(centerPosition)
                      sigunguOverlayRef.current.setMap(mapRef.current)
                      currentTooltipNameRef.current = sigunguName
                    }
                  }
                })

                // mouseout 이벤트
                window.kakao.maps.event.addListener(detailPolygon, 'mouseout', function() {
                  // 약간의 지연 후 색상 복원 및 툴팁 숨기기 (다른 polygon으로 빠르게 이동할 때 깜빡임 방지)
                  mouseoutTimeoutRef.current = setTimeout(() => {
                    // 같은 이름의 polygon이 여전히 활성화되어 있지 않으면 색상 복원
                    if (activePolygonNameRef.current === sigunguName) {
                      if (polygonGroups[sigunguName]) {
                        polygonGroups[sigunguName].forEach((poly: any) => {
                          poly.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                        })
                      }
                      activePolygonNameRef.current = null
                    }
                    
                    if (sigunguOverlayRef.current) {
                      sigunguOverlayRef.current.setMap(null)
                      currentTooltipNameRef.current = null
                    }
                    mouseoutTimeoutRef.current = null
                  }, 50) as unknown as number // 지연 시간을 줄여서 더 빠르게 반응
                })

                window.kakao.maps.event.addListener(detailPolygon, 'click', function() {
                  // 선택된 시/군/구 저장 (오른쪽 위 라벨 업데이트)
                  setSelectedCity(sigunguName)
                  
                  // 폴리곤의 경계로 지도 확대
                  const bounds = new window.kakao.maps.LatLngBounds()
                  polygonPath.forEach((latlng: any) => bounds.extend(latlng))
                  mapRef.current.setBounds(bounds)
                })

                detailPolygonsRef.current.push(detailPolygon)
              }
            }
          }
        })
      })
      .catch(error => {
        console.error('[상세 지도] GeoJSON 로드 실패:', error)
      })

    return () => {
      // 클린업
      detailPolygonsRef.current.forEach(polygon => polygon.setMap(null))
      detailPolygonsRef.current = []
    }
  }, [showDetailMap, selectedRegion])

  const resetFilters = () => {
    setSelectedRegion(null)
    setSelectedCity(null)
    setShowDetailMap(false)
    setCategoryFilter('all')
    setSearchTerm('')
    dispatch({ type: 'CLEAR_FILTERS' })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
    
    // 지도를 대한민국 전체 보기로 복귀
    if (mapRef.current) {
      try {
        if (koreaBoundsRef.current) {
          // GeoJSON 경계를 사용하여 정확히 대한민국만 보이도록
          mapRef.current.setBounds(koreaBoundsRef.current)
        } else {
          // fallback: 수동 설정
          const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
          mapRef.current.setCenter(moveLatLon)
          mapRef.current.setLevel(13)
        }
      } catch (error) {
        console.error('[초기화] 지도 복원 실패:', error)
        // 에러 발생 시 강제 수동 설정
        const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
        mapRef.current.setCenter(moveLatLon)
        mapRef.current.setLevel(13)
      }
    }
    
    // 시/군/구 경계선 제거
    detailPolygonsRef.current.forEach(polygon => polygon.setMap(null))
    detailPolygonsRef.current = []
    
    // 모든 시/도 경계선 다시 표시
    showAllRegionPolygons()
  }

  // 모든 시/도 경계선 표시/숨김 관리 함수
  const showAllRegionPolygons = useCallback(() => {
    if (!mapRef.current) return
    polygonsRef.current.forEach(({ polygon }) => {
      polygon.setMap(mapRef.current)
      const originalStrokeColor = (polygon as any)._originalStrokeColor ?? '#10b981'
      // 모든 지역을 동일한 스타일로 복원 (이전 선택 상태와 무관하게)
      polygon.setOptions({ 
        fillColor: '#fff', 
        fillOpacity: 0.05, // 항상 동일한 투명도로 복원
        strokeColor: originalStrokeColor, // 원래 테두리 색상 복원
        strokeOpacity: 0.9
      })
      ;(polygon as any)._originalOpacity = 0.05 // 원래 opacity 복원
    })
  }, [])

  const handleCategoryChange = (option: CategoryFilter) => {
    setCategoryFilter(option)
    const nextCategory = option === 'all' ? null : option
    if (state.selectedCategory !== nextCategory) {
      dispatch({ type: 'SELECT_CATEGORY', payload: nextCategory })
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
    <div className="pb-12">
      <section className="mx-auto grid max-w-content grid-cols-1 gap-4 px-4 md:gap-6 md:px-6 md:grid-cols-[minmax(0,4.2fr)_minmax(320px,1.2fr)] lg:gap-10">
        <div className="relative flex flex-col gap-3 md:gap-5">
          <div className="rounded-2xl border border-surface-subtle bg-white p-4 shadow-sm md:rounded-3xl md:p-7 lg:p-8 overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 md:mb-4 md:gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900 md:text-lg lg:text-xl truncate">
                  대한민국 지역 지도
                </h2>
                <p className="text-xs text-slate-600 md:text-sm truncate">
                  {selectedRegion && REGION_INFO[selectedRegion]
                    ? `${REGION_INFO[selectedRegion].name} 선택됨`
                    : '지도를 탐색하고 원하는 위치를 검색해보세요.'}
                </p>
              </div>
              {(selectedRegion || selectedCity || searchTerm || categoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 md:px-3 md:py-1"
                >
                  <X className="h-3 w-3" /> 
                  <span className="hidden sm:inline">초기화</span>
                </button>
              )}
            </div>

            {/* 카카오맵 컨테이너 - 단일 지도 */}
            <div className="relative">
              {/* 뒤로 가기 버튼 (지역 선택 시에만 표시) */}
              {showDetailMap && selectedRegion && (
                <div className="absolute top-2 left-2 z-10 md:top-4 md:left-4">
                  <button
                    type="button"
                    onClick={() => {
                      // 시/군/구 선택 상태인 경우: 도/광역시로 돌아가기
                      if (selectedCity) {
                        setSelectedCity(null)
                        
                        // 도/광역시 경계로 다시 확대
                        if (mapRef.current && selectedRegion && REGION_COORDINATES[selectedRegion]) {
                          const coords = REGION_COORDINATES[selectedRegion]
                          const moveLatLon = new window.kakao.maps.LatLng(coords.lat, coords.lng)
                          mapRef.current.setCenter(moveLatLon)
                          mapRef.current.setLevel(coords.level)
                        }
                      } else {
                        // 도/광역시 선택 상태인 경우: 전국 지도로 돌아가기
                        setShowDetailMap(false)
                        setSelectedRegion(null)
                        dispatch({ type: 'SELECT_REGION', payload: null })
                        
                        // 전국 지도로 복귀
                        if (mapRef.current) {
                          try {
                            if (koreaBoundsRef.current) {
                              mapRef.current.setBounds(koreaBoundsRef.current)
                            } else {
                              // fallback: 수동 설정
                              const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
                              mapRef.current.setCenter(moveLatLon)
                              mapRef.current.setLevel(13)
                            }
                          } catch (error) {
                            console.error('[뒤로 가기] 지도 복원 실패:', error)
                            // 에러 발생 시 강제 수동 설정
                            const moveLatLon = new window.kakao.maps.LatLng(36.5, 127.8)
                            mapRef.current.setCenter(moveLatLon)
                            mapRef.current.setLevel(13)
                          }
                        }
                        
                        // 시/군/구 경계선 제거
                        detailPolygonsRef.current.forEach(polygon => polygon.setMap(null))
                        detailPolygonsRef.current = []
                        
                        // 모든 시/도 경계선 다시 표시
                        showAllRegionPolygons()
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white hover:bg-slate-50 transition-colors shadow-lg border border-slate-200 text-xs md:gap-2 md:px-4 md:py-2 md:text-sm"
                    title="뒤로 가기"
                  >
                    <ArrowLeft className="h-4 w-4 text-slate-700 md:h-5 md:w-5" />
                    <span className="font-medium text-slate-700 max-w-[100px] truncate md:max-w-none">
                      {selectedCity ? REGION_INFO[selectedRegion]?.name : '전체 지도'}
                    </span>
                  </button>
                </div>
              )}

              {/* 지역 정보 라벨 (지역 선택 시에만 표시) */}
              {showDetailMap && selectedRegion && (
                <div className="absolute top-2 right-2 z-10 md:top-4 md:right-4">
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white shadow-lg border border-slate-200 md:gap-2 md:px-4 md:py-2">
                    <span className="text-base md:text-xl">{REGION_INFO[selectedRegion]?.emoji}</span>
                    <span className="text-xs font-bold text-slate-900 max-w-[100px] truncate md:text-sm md:max-w-none">
                      {selectedCity || REGION_INFO[selectedRegion]?.name}
                    </span>
                  </div>
                </div>
              )}
              
              <div 
                ref={mapContainerRef}
                className="relative overflow-hidden rounded-2xl border border-surface-subtle h-[350px] md:h-[500px] lg:h-[600px] md:rounded-3xl"
              />
              </div>
              
            </div>
        </div>

        <aside className="flex flex-col gap-3 md:gap-4 lg:gap-6">
          <div className="rounded-2xl border border-surface-subtle bg-white p-4 shadow-sm md:rounded-3xl md:p-5 lg:p-6">
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {categoryOptions.map((option) => {
                const categoryInfo = option === 'all' 
                  ? { label: '전체', emoji: '🌐' }
                  : SPORT_CATEGORIES.find(cat => cat.value === option)
                
                return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleCategoryChange(option)}
                    className={`flex items-center justify-center gap-0.5 rounded-full border px-2 py-1.5 text-xs transition md:gap-1 md:px-3 md:py-2 ${
                    categoryFilter === option
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                    {categoryInfo?.emoji && <span className="text-xs md:text-sm flex-shrink-0">{categoryInfo.emoji}</span>}
                    <span className="text-[10px] md:text-xs truncate">{categoryInfo?.label || CATEGORY_LABELS[option]}</span>
                </button>
                )
              })}
            </div>
          </div>

          {/* 맞춤 추천 행사 */}
          {isAuthenticated && recommendedEvents.length > 0 && (
            <div className="rounded-2xl border border-surface-subtle bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm md:rounded-3xl md:p-6 lg:p-8">
              <div className="mb-2 flex items-center justify-between md:mb-3">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 md:gap-2 md:text-sm">
                  <Star className="h-3.5 w-3.5 text-amber-500 md:h-4 md:w-4" fill="currentColor" />
                  맞춤 추천
                </h2>
                <span className="text-[10px] text-amber-600 md:text-xs">{recommendedEvents.length}건</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto md:max-h-[250px]">
                <ul className="flex flex-col divide-y divide-surface-subtle">
                  {recommendedEvents.map((event) => {
                    const regionLabel = REGION_INFO[event.region]?.name?.replace(/특별자치도|특별자치시|특별시|광역시|도/g, '') ?? event.region
                    return (
                      <li key={event.id} className="py-2 md:py-3">
                        <div className="w-full text-left">
                          <div className="flex flex-col gap-0.5 md:gap-1">
                            <a
                              href={`/events/${event.id}`}
                              className="text-xs font-semibold text-slate-900 hover:text-brand-primary transition-colors cursor-pointer line-clamp-2 md:text-sm md:line-clamp-none"
                            >
                              {event.title}
                            </a>
                            <span className="text-[10px] text-slate-500 md:text-xs">
                              {regionLabel} · {event.city} · {event.start_at ? formatDate(event.start_at) : formatDate(event.date)}
                              {event.end_at && event.start_at !== event.end_at && (
                                <> ~ {formatDate(event.end_at)}</>
                              )}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1 md:mt-1 md:gap-2">
                              <Tag label={CATEGORY_LABELS[event.category]} />
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-2 md:text-xs">{event.summary}</p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* 전체 행사 목록 */}
          <div className="rounded-2xl border border-surface-subtle bg-white p-4 shadow-sm md:rounded-3xl md:p-6 lg:p-8">
            <div className="mb-2 flex items-center justify-between md:mb-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 md:gap-2 md:text-sm">
                <Calendar className="h-3.5 w-3.5 text-brand-primary md:h-4 md:w-4" />
                전체 행사
              </h2>
              <span className="text-[10px] text-slate-500 md:text-xs">{filteredEvents.length}건</span>
            </div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 md:py-12">
                <div className="mb-2 h-6 w-6 animate-spin rounded-full border-4 border-brand-primary border-t-transparent md:mb-3 md:h-8 md:w-8"></div>
                <p className="text-xs text-slate-500 md:text-sm">행사를 불러오는 중...</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto md:max-h-[445px]">
                <ul className="flex flex-col divide-y divide-surface-subtle">
                  {filteredEvents.length ? (
                    filteredEvents.map((event) => {
                      const regionLabel = REGION_INFO[event.region]?.name?.replace(/특별자치도|특별자치시|특별시|광역시|도/g, '') ?? event.region
                      return (
                        <li key={event.id} className="py-2 md:py-3">
                          <div className="w-full text-left">
                            <div className="flex flex-col gap-0.5 md:gap-1">
                              <a
                                href={`/events/${event.id}`}
                                className="text-xs font-semibold text-slate-900 hover:text-brand-primary transition-colors cursor-pointer line-clamp-2 md:text-sm md:line-clamp-none"
                              >
                                {event.title}
                              </a>
                              <span className="text-[10px] text-slate-500 md:text-xs">
                                {regionLabel} · {event.city} · {event.start_at ? formatDate(event.start_at) : formatDate(event.date)}
                                {event.end_at && event.start_at !== event.end_at && (
                                  <> ~ {formatDate(event.end_at)}</>
                                )}
                              </span>
                              <div className="mt-0.5 flex items-center gap-1 md:mt-1 md:gap-2">
                                <Tag label={CATEGORY_LABELS[event.category]} />
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-2 md:text-xs">{event.summary}</p>
                            </div>
                          </div>
                        </li>
                      )
                    })
                  ) : (
                    <li className="py-4 text-center text-xs text-slate-500 md:py-6 md:text-sm">
                      조건에 맞는 행사가 없습니다.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}

