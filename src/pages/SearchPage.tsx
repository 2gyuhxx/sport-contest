import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Search, MapPin, Calendar, ChevronRight, X, ArrowLeft, Star, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import type { Category, Event } from '../types/events'
import { CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../utils/categoryLabels'
import { KOREA_REGION_PATHS } from '../data/koreaRegionPaths'
import { FavoriteService } from '../services/FavoriteService'
import { findSimilarUsers, recommendSportsFromSimilarUsers } from '../utils/cosineSimilarity'
import '../types/naver.d.ts'

type CategoryFilter = 'all' | Category

// 지역별 중심 좌표
const REGION_COORDINATES: Record<string, { lat: number; lng: number; level: number }> = {
  seoul: { lat: 37.5665, lng: 126.9780, level: 9 },
  busan: { lat: 35.1796, lng: 129.0756, level: 10 },
  daegu: { lat: 35.8714, lng: 128.6014, level: 10 },
  incheon: { lat: 37.4563, lng: 126.7052, level: 10 },
  gwangju: { lat: 35.1595, lng: 126.8526, level: 10 },
  daejeon: { lat: 36.3504, lng: 127.3845, level: 10 },
  ulsan: { lat: 35.5384, lng: 129.3114, level: 10 },
  sejong: { lat: 36.4800, lng: 127.2890, level: 10 },
  gyeonggi: { lat: 37.4138, lng: 127.5183, level: 11 },
  gangwon: { lat: 37.8228, lng: 128.1555, level: 12 },
  chungbuk: { lat: 36.6357, lng: 127.4914, level: 11 },
  chungnam: { lat: 36.5184, lng: 126.8000, level: 11 },
  jeonbuk: { lat: 35.7175, lng: 127.1530, level: 11 },
  jeonnam: { lat: 34.8161, lng: 126.4629, level: 11 },
  gyeongbuk: { lat: 36.4919, lng: 128.8889, level: 12 },
  gyeongnam: { lat: 35.4606, lng: 128.2132, level: 11 },
  jeju: { lat: 33.4890, lng: 126.4983, level: 10 },
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

// 지역 정보
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

export function SearchPage() {
  const navigate = useNavigate()
  const { state, dispatch, isLoading } = useEventContext()
  const { events } = state
  const { state: authState } = useAuthContext()
  const { user, isAuthenticated } = authState

  // 지도 관련 ref
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const infowindowRef = useRef<any>(null)
  const detailPolygonsRef = useRef<any[]>([])
  const currentTooltipNameRef = useRef<string | null>(null)
  const mouseoutTimeoutRef = useRef<number | null>(null)
  const activePolygonNameRef = useRef<string | null>(null)
  const polygonsRef = useRef<{ polygon: any; regionId: string }[]>([])
  const customOverlayRef = useRef<any>(null)
  const sigunguOverlayRef = useRef<any>(null)
  const sigunguTooltipMarkerRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const markerInfoWindowRef = useRef<any>(null)
  const sigunguPolygonGroupsRef = useRef<Record<string, any[]>>({})
  const mousePositionRef = useRef<{ lat: number; lng: number } | null>(null)
  const selectedCityRef = useRef<string | null>(null)
  const mouseMoveListenerRef = useRef<any>(null)
  const selectedRegionRef = useRef<string | null>(null)
  const showDetailMapRef = useRef<boolean>(false)
  const categoryScrollDraggingRef = useRef<boolean>(false)

  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showDetailMap, setShowDetailMap] = useState(false)
  const [naverMapsLoaded, setNaverMapsLoaded] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = (state?.selectedCategory ?? 'all') as CategoryFilter
  const initialKeyword = state?.keyword ?? ''

  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
  const [searchTerm, setSearchTerm] = useState(initialKeyword)
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])

  // 네이버맵 SDK 로드
  useEffect(() => {
    if (window.naver?.maps) {
      setNaverMapsLoaded(true)
      return
    }

    const existingScript = document.querySelector(`script[src*="naver.com/openapi"]`)
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.naver?.maps) {
          setNaverMapsLoaded(true)
          clearInterval(checkLoaded)
      }
    }, 100)
      return () => clearInterval(checkLoaded)
    }

    const script = document.createElement('script')
    const naverClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID || 'jrhgu3q88b'
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${naverClientId}&submodules=geocoder`
    script.async = true
    script.onload = () => {
      const checkLoaded = setInterval(() => {
        if (window.naver?.maps) {
          setNaverMapsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
    }
    document.head.appendChild(script)
  }, [])

  // 지도 초기화
  useEffect(() => {
    if (!naverMapsLoaded || !mapContainerRef.current || mapRef.current) return

    const mapOptions = {
      center: new window.naver.maps.LatLng(36.5, 125.5),
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: true,
      zoomControlOptions: {
        position: 7, // RIGHT_CENTER
        style: 1, // SMALL
      },
      mapTypeControl: false,
      scaleControl: false,
      logoControl: false,
      mapDataControl: false,
    }

    const map = new window.naver.maps.Map(mapContainerRef.current, mapOptions)
    mapRef.current = map

    // 지역 Polygon 생성
    initializeRegionPolygons(map)

  }, [naverMapsLoaded])

  // 지역 Polygon 초기화
  const initializeRegionPolygons = useCallback((map: any) => {
    if (!window.naver?.maps) return

    // 지역명을 regionId로 변환
    const getRegionIdFromName = (name: string): string => {
      const nameToId: Record<string, string> = {
        '서울특별시': 'seoul', '서울': 'seoul',
        '부산광역시': 'busan', '부산': 'busan',
        '대구광역시': 'daegu', '대구': 'daegu',
        '인천광역시': 'incheon', '인천': 'incheon',
        '광주광역시': 'gwangju', '광주': 'gwangju',
        '대전광역시': 'daejeon', '대전': 'daejeon',
        '울산광역시': 'ulsan', '울산': 'ulsan',
        '세종특별자치시': 'sejong', '세종': 'sejong',
        '경기도': 'gyeonggi', '경기': 'gyeonggi',
        '강원도': 'gangwon', '강원특별자치도': 'gangwon', '강원': 'gangwon',
        '충청북도': 'chungbuk', '충북': 'chungbuk',
        '충청남도': 'chungnam', '충남': 'chungnam',
        '전라북도': 'jeonbuk', '전북특별자치도': 'jeonbuk', '전북': 'jeonbuk',
        '전라남도': 'jeonnam', '전남': 'jeonnam',
        '경상북도': 'gyeongbuk', '경북': 'gyeongbuk',
        '경상남도': 'gyeongnam', '경남': 'gyeongnam',
        '제주특별자치도': 'jeju', '제주도': 'jeju', '제주': 'jeju',
      }
      return nameToId[name] || ''
    }

    // Polygon 생성 함수
    const createPolygon = (regionId: string, polygonPath: any[]) => {
      const regionInfo = REGION_INFO[regionId]
      if (!regionInfo) return

      // 광역시는 도보다 위에 표시되어야 함 (zIndex를 크게 설정)
      const isMetropolitan = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'].includes(regionId)
      const baseZIndex = isMetropolitan ? 100 : 1

      const polygon = new window.naver.maps.Polygon({
        map: map,
        paths: polygonPath,
        strokeWeight: isMetropolitan ? 2 : 1.5,
        strokeColor: '#007AFF',
        strokeOpacity: isMetropolitan ? 0.8 : 0.5,
        strokeStyle: 'solid',
        fillColor: '#007AFF',
        fillOpacity: 0.06,
        clickable: true,
        zIndex: baseZIndex,
      })

      ;(polygon as any)._originalOpacity = 0.06
      ;(polygon as any)._originalStrokeColor = '#007AFF'

      // 클릭 이벤트
      window.naver.maps.Event.addListener(polygon, 'click', function() {
        if (infowindowRef.current) infowindowRef.current.close()
        if (customOverlayRef.current) customOverlayRef.current.setMap(null)
        
        polygon.setOptions({ fillColor: '#007AFF', fillOpacity: 0.06 })
        
        const coords = REGION_COORDINATES[regionId]
        if (coords && mapRef.current && window.naver?.maps) {
          // 사이드바를 피해 오른쪽 중간에 위치하도록 경도 조정
          // 광역시/특별시는 작은 지역이므로 작게 조정, 도는 큰 지역이므로 크게 조정
          const adjustedLng = isMetropolitan ? coords.lng - 0.2 : coords.lng - 1.2
          const targetLatLng = new window.naver.maps.LatLng(coords.lat, adjustedLng)
          const zoom = isMetropolitan ? 11 : Math.max(8, Math.min(9, 14 - coords.level + 2))
          
          // 즉시 설정 (다른 로직보다 우선)
          mapRef.current.setCenter(targetLatLng)
          mapRef.current.setZoom(zoom)
          
        setSelectedRegion(regionId)
        setShowDetailMap(true)
        dispatch({ type: 'SELECT_REGION', payload: regionId })
        
          // 다른 로직이 실행된 후에도 지도 위치 유지
          setTimeout(() => {
            if (mapRef.current && window.naver?.maps) {
              mapRef.current.setCenter(targetLatLng)
              mapRef.current.setZoom(zoom)
            }
          }, 300)
        } else {
          setSelectedRegion(regionId)
          setShowDetailMap(true)
          dispatch({ type: 'SELECT_REGION', payload: regionId })
        }
        
        // 광역시가 속한 도 숨기기
        const METRO_TO_PROVINCE: Record<string, string> = {
          'gwangju': 'jeonnam',
          'daejeon': 'chungnam',
          'ulsan': 'gyeongnam',
        }
        const provinceToHide = METRO_TO_PROVINCE[regionId]
        
        polygonsRef.current.forEach(({ polygon: p, regionId: rid }) => {
          if (rid === regionId) {
            p.setMap(mapRef.current)
            p.setOptions({ 
              fillColor: '#007AFF', 
              fillOpacity: 0,
              strokeColor: '#007AFF',
              strokeWeight: 2.5,
              strokeOpacity: 1,
              zIndex: 10
            })
          } else if (rid === provinceToHide) {
            p.setMap(null)
          } else {
            // 다른 지역: 흰색으로 흐려지게 (경계선은 명확하게 표시)
            p.setMap(mapRef.current)
            p.setOptions({ 
              fillColor: '#ffffff', 
              fillOpacity: 0.75,
              strokeColor: '#9ca3af',
              strokeWeight: 1.5,
              strokeOpacity: 0.8,
              zIndex: 1
            })
          }
        })
      })

      // 마우스 오버
      window.naver.maps.Event.addListener(polygon, 'mouseover', function() {
        // showDetailMap이 true이고 선택된 지역이 아닐 때는 흐려진 스타일 유지
        if (showDetailMapRef.current && selectedRegionRef.current !== regionId) {
          // 흐려진 스타일 유지 (변경하지 않음)
          return
        }
        if (!showDetailMapRef.current) {
          polygon.setOptions({ fillOpacity: 0.15, strokeWeight: 2 })
        }
      })

      // 마우스 아웃
      window.naver.maps.Event.addListener(polygon, 'mouseout', function() {
        // showDetailMap이 true이고 선택된 지역이 아닐 때는 흐려진 스타일 유지 (경계선은 명확하게)
        if (showDetailMapRef.current && selectedRegionRef.current !== regionId) {
          // 흐려진 스타일 유지 (경계선은 명확하게 표시)
          polygon.setOptions({
            fillColor: '#ffffff',
            fillOpacity: 0.75,
            strokeColor: '#9ca3af',
            strokeWeight: 1.5,
            strokeOpacity: 0.8,
            zIndex: 1
          })
          return
        }
        if (!showDetailMapRef.current) {
          polygon.setOptions({ 
            fillOpacity: (polygon as any)._originalOpacity, 
            strokeWeight: 1.5 
          })
        }
      })

      polygonsRef.current.push({ polygon, regionId })
    }

    // 광역시 목록 (도보다 나중에 렌더링해야 함)
    const metropolitanCities = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan']

    // GeoJSON 로드
    fetch('/korea-regions.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        const loadedRegionIds = new Set<string>()
        const metropolitanFeatures: any[] = []
        const provinceFeatures: any[] = []
        
        // 먼저 도와 광역시를 분리
        geojson.features.forEach((feature: any) => {
          const regionName = feature.properties?.name || feature.properties?.CTP_KOR_NM || feature.properties?.NAME || ''
          const regionId = getRegionIdFromName(regionName)
          if (!regionId) return

          if (metropolitanCities.includes(regionId)) {
            metropolitanFeatures.push({ feature, regionId })
          } else {
            provinceFeatures.push({ feature, regionId })
          }
        })

        // 1. 먼저 도(province) 렌더링
        provinceFeatures.forEach(({ feature, regionId }) => {
          loadedRegionIds.add(regionId)
          const geometry = feature.geometry
          
          if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon: any) => {
              const outerRing = polygon[0]
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 3 === 0)
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
                new window.naver.maps.LatLng(coord[1], coord[0])
              )
              if (polygonPath.length >= 3) {
                createPolygon(regionId, polygonPath)
              }
            })
          } else if (geometry.type === 'Polygon') {
            const outerRing = geometry.coordinates[0]
            const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 3 === 0)
            const polygonPath = simplifiedCoords.map((coord: number[]) => 
              new window.naver.maps.LatLng(coord[1], coord[0])
            )
            if (polygonPath.length >= 3) {
              createPolygon(regionId, polygonPath)
            }
          }
        })

        // 2. 그 다음 광역시 렌더링 (도 위에 표시됨)
        metropolitanFeatures.forEach(({ feature, regionId }) => {
          loadedRegionIds.add(regionId)
          const geometry = feature.geometry
          
          if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon: any) => {
              const outerRing = polygon[0]
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 3 === 0)
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
                new window.naver.maps.LatLng(coord[1], coord[0])
              )
              if (polygonPath.length >= 3) {
                createPolygon(regionId, polygonPath)
              }
            })
          } else if (geometry.type === 'Polygon') {
            const outerRing = geometry.coordinates[0]
            const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 3 === 0)
            const polygonPath = simplifiedCoords.map((coord: number[]) => 
              new window.naver.maps.LatLng(coord[1], coord[0])
            )
            if (polygonPath.length >= 3) {
              createPolygon(regionId, polygonPath)
            }
          }
        })
        
        // Fallback (GeoJSON에 없는 지역)
        Object.entries(KOREA_REGION_PATHS).forEach(([regionId, path]) => {
          if (!loadedRegionIds.has(regionId)) {
            const polygonPath = path.map(coord => new window.naver.maps.LatLng(coord.lat, coord.lng))
            if (polygonPath.length >= 3) {
              createPolygon(regionId, polygonPath)
            }
          }
        })
      })
      .catch(() => {
        // Fallback: 도 먼저, 광역시 나중에
        const provinceEntries = Object.entries(KOREA_REGION_PATHS).filter(([id]) => !metropolitanCities.includes(id))
        const metroEntries = Object.entries(KOREA_REGION_PATHS).filter(([id]) => metropolitanCities.includes(id))
        
        provinceEntries.forEach(([regionId, path]) => {
          const polygonPath = path.map(coord => new window.naver.maps.LatLng(coord.lat, coord.lng))
          createPolygon(regionId, polygonPath)
        })
        metroEntries.forEach(([regionId, path]) => {
          const polygonPath = path.map(coord => new window.naver.maps.LatLng(coord.lat, coord.lng))
          createPolygon(regionId, polygonPath)
        })
      })
  }, [dispatch, showDetailMap])

  // ref를 state와 동기화
  useEffect(() => {
    selectedRegionRef.current = selectedRegion
  }, [selectedRegion])

  useEffect(() => {
    showDetailMapRef.current = showDetailMap
  }, [showDetailMap])

  // 선택된 지역에 따라 다른 지역들을 흰색으로 흐려지게 표시
  useEffect(() => {
    if (!showDetailMap || !selectedRegion || !mapRef.current || !window.naver?.maps) {
      // 선택이 해제되면 모든 polygon을 원래 스타일로 복원
      if (polygonsRef.current.length > 0) {
        polygonsRef.current.forEach(({ polygon, regionId }) => {
          const isMetropolitan = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'].includes(regionId)
          polygon.setMap(mapRef.current)
          polygon.setOptions({
            fillColor: '#007AFF',
            fillOpacity: 0.06,
            strokeColor: '#007AFF',
            strokeWeight: isMetropolitan ? 2 : 1.5,
            strokeOpacity: isMetropolitan ? 0.8 : 0.5,
            zIndex: isMetropolitan ? 100 : 1
          })
        })
      }
                  return
                }
                
    const METRO_TO_PROVINCE: Record<string, string> = {
      'gwangju': 'jeonnam',
      'daejeon': 'chungnam',
      'ulsan': 'gyeongnam',
    }
    const provinceToHide = METRO_TO_PROVINCE[selectedRegion]

    polygonsRef.current.forEach(({ polygon, regionId }) => {
      if (regionId === selectedRegion) {
        // 선택된 지역: 정상적으로 강조
        polygon.setMap(mapRef.current)
        polygon.setOptions({
          fillColor: '#007AFF',
          fillOpacity: 0,
          strokeColor: '#007AFF',
          strokeWeight: 2.5,
          strokeOpacity: 1,
          zIndex: 10
        })
      } else if (regionId === provinceToHide) {
        // 광역시가 속한 도: 숨기기
        polygon.setMap(null)
            } else {
        // 다른 지역: 흰색으로 흐려지게 (경계선은 명확하게 표시)
        polygon.setMap(mapRef.current)
        polygon.setOptions({
          fillColor: '#ffffff',
          fillOpacity: 0.75,
          strokeColor: '#9ca3af',
          strokeWeight: 1.5,
          strokeOpacity: 0.8,
          zIndex: 1
          })
        }
      })
  }, [selectedRegion, showDetailMap])

  // 시/군/구 경계선 표시
  useEffect(() => {
    if (!showDetailMap || !mapRef.current || !window.naver?.maps || !selectedRegion) return

    detailPolygonsRef.current.forEach(polygon => polygon.setMap(null))
    detailPolygonsRef.current = []
    sigunguPolygonGroupsRef.current = {}
    currentTooltipNameRef.current = null
    if (mouseoutTimeoutRef.current) {
      clearTimeout(mouseoutTimeoutRef.current)
      mouseoutTimeoutRef.current = null
    }
    activePolygonNameRef.current = null
    
    fetch('/korea-sigungu.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        const regionName = REGION_INFO[selectedRegion]?.name
        if (!regionName) return

        const REGION_CODE_MAP: Record<string, string> = {
          'seoul': '11', 'busan': '21', 'daegu': '22', 'incheon': '23',
          'gwangju': '24', 'daejeon': '25', 'ulsan': '26', 'sejong': '29',
          'gyeonggi': '31', 'gangwon': '32', 'chungbuk': '33', 'chungnam': '34',
          'jeonbuk': '35', 'jeonnam': '36', 'gyeongbuk': '37', 'gyeongnam': '38',
          'jeju': '39',
        }
        
        const regionCode = REGION_CODE_MAP[selectedRegion]
        
        geojson.features.forEach((feature: any) => {
          const sigunguName = feature.properties.name || feature.properties.SIG_KOR_NM || ''
          const sigunguCode = feature.properties.code || feature.properties.SIG_CD || feature.properties.CTPRVN_CD || ''
          
          if (!sigunguCode.startsWith(regionCode)) return
          
            const geometry = feature.geometry
            
          const createDetailPolygon = (polygonPath: any[]) => {
            const detailPolygon = new window.naver.maps.Polygon({
              map: mapRef.current,
              paths: polygonPath,
              strokeWeight: 1,
              strokeColor: '#007AFF',
              strokeOpacity: 0.35,
                    strokeStyle: 'solid',
              fillColor: '#007AFF',
              fillOpacity: 0.02,
              clickable: true,
              zIndex: 50,
            })

            if (!sigunguPolygonGroupsRef.current[sigunguName]) {
              sigunguPolygonGroupsRef.current[sigunguName] = []
            }
            sigunguPolygonGroupsRef.current[sigunguName].push(detailPolygon)

            window.naver.maps.Event.addListener(detailPolygon, 'mouseover', function() {
                    if (mouseoutTimeoutRef.current) {
                      clearTimeout(mouseoutTimeoutRef.current)
                      mouseoutTimeoutRef.current = null
                    }
                    
              if (currentTooltipNameRef.current === sigunguName && sigunguOverlayRef.current) return
              
              // 선택된 시/군/구는 마우스 호버 시에도 스타일 변경하지 않음 (ref 사용하여 최신 값 참조)
              const isCurrentSelected = selectedCityRef.current === sigunguName
              
              // 이전 호버된 시/군/구를 원래 스타일로 복원 (단, 선택된 시/군/구가 아닌 경우)
              if (activePolygonNameRef.current && activePolygonNameRef.current !== sigunguName && sigunguPolygonGroupsRef.current[activePolygonNameRef.current]) {
                const isPreviousSelected = selectedCityRef.current === activePolygonNameRef.current
                if (!isPreviousSelected) {
                  // 선택되지 않은 이전 호버 시/군/구만 원래 스타일로 복원
                  sigunguPolygonGroupsRef.current[activePolygonNameRef.current].forEach((poly: any) => {
                    poly.setOptions({
                      fillColor: '#007AFF',
                      fillOpacity: 0.02,
                      strokeColor: '#007AFF',
                      strokeWeight: 1,
                      strokeOpacity: 0.35,
                      zIndex: 50
                    })
                  })
                }
                // 선택된 시/군/구는 스타일 변경하지 않음
              }
              
              // 호버된 시/군/구 강조 (단, 선택된 시/군/구가 아닌 경우만)
              if (!isCurrentSelected && sigunguPolygonGroupsRef.current[sigunguName]) {
                sigunguPolygonGroupsRef.current[sigunguName].forEach((poly: any) => {
                  // 호버 시 약간 강조
                  poly.setOptions({
                    fillColor: '#007AFF',
                    fillOpacity: 0.25,
                    strokeColor: '#007AFF',
                    strokeWeight: 1,
                    strokeOpacity: 0.35,
                    zIndex: 50
                  })
                })
              } else if (isCurrentSelected && sigunguPolygonGroupsRef.current[sigunguName]) {
                // 선택된 시/군/구는 강조 스타일 명시적으로 유지
                sigunguPolygonGroupsRef.current[sigunguName].forEach((poly: any) => {
                  poly.setOptions({
                    fillColor: '#007AFF',
                    fillOpacity: 0.1,
                    strokeColor: '#007AFF',
                    strokeWeight: 3,
                    strokeOpacity: 1,
                    zIndex: 100
                  })
                })
              }
              
              // 선택된 시/군/구가 다른 곳에 있으면 그 스타일도 명시적으로 유지
              if (selectedCityRef.current && selectedCityRef.current !== sigunguName && sigunguPolygonGroupsRef.current[selectedCityRef.current]) {
                sigunguPolygonGroupsRef.current[selectedCityRef.current].forEach((poly: any) => {
                  poly.setOptions({
                    fillColor: '#007AFF',
                    fillOpacity: 0.1,
                    strokeColor: '#007AFF',
                    strokeWeight: 3,
                    strokeOpacity: 1,
                    zIndex: 100
                  })
                      })
                    }
                    
                    activePolygonNameRef.current = sigunguName
                    
              // Apple 스타일 툴팁 (마우스 위치 사용하여 지도 이동 방지)
              if (mousePositionRef.current) {
                const mousePosition = new window.naver.maps.LatLng(mousePositionRef.current.lat, mousePositionRef.current.lng)
                
                // 툴팁 마커 생성 또는 위치 업데이트 (지도 이동 방지)
                if (!sigunguTooltipMarkerRef.current) {
                  sigunguTooltipMarkerRef.current = new window.naver.maps.Marker({
                    position: mousePosition,
                    map: mapRef.current,
                    icon: {
                      content: '',
                      anchor: new window.naver.maps.Point(0, 0),
                    },
                    visible: false,
                    zIndex: 1000,
                  })
                } else {
                  sigunguTooltipMarkerRef.current.setPosition(mousePosition)
                }
                
                if (!sigunguOverlayRef.current) {
                  sigunguOverlayRef.current = new window.naver.maps.InfoWindow({
                    content: `<div style="padding: 10px 16px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; color: #1d1d1f; white-space: nowrap; letter-spacing: -0.01em;">${sigunguName}</div>`,
                    disableAnchor: true,
                    borderWidth: 0,
                    backgroundColor: 'transparent',
                    pixelOffset: new window.naver.maps.Point(0, -15),
                  })
                } else {
                  sigunguOverlayRef.current.setContent(`<div style="padding: 10px 16px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; color: #1d1d1f; white-space: nowrap; letter-spacing: -0.01em;">${sigunguName}</div>`)
                }
                // 마커를 사용하여 툴팁 표시 (지도 이동 없이)
                sigunguOverlayRef.current.open(mapRef.current, sigunguTooltipMarkerRef.current)
                        currentTooltipNameRef.current = sigunguName
                    }
                  })

            window.naver.maps.Event.addListener(detailPolygon, 'mouseout', function() {
                    mouseoutTimeoutRef.current = setTimeout(() => {
                      if (activePolygonNameRef.current === sigunguName) {
                  // ref 사용하여 최신 값 참조
                  const isSelected = selectedCityRef.current === sigunguName
                  
                  // 선택된 시/군/구는 스타일 변경하지 않음
                  if (!isSelected && sigunguPolygonGroupsRef.current[sigunguName]) {
                    // 선택되지 않은 시/군/구만 원래 스타일로 복원
                    sigunguPolygonGroupsRef.current[sigunguName].forEach((poly: any) => {
                      poly.setOptions({
                        fillColor: '#007AFF',
                        fillOpacity: 0.02,
                        strokeColor: '#007AFF',
                        strokeWeight: 1,
                        strokeOpacity: 0.35,
                        zIndex: 50
                      })
                    })
                  } else if (isSelected && sigunguPolygonGroupsRef.current[sigunguName]) {
                    // 선택된 시/군/구는 강조 스타일 명시적으로 유지
                    sigunguPolygonGroupsRef.current[sigunguName].forEach((poly: any) => {
                      poly.setOptions({
                        fillColor: '#007AFF',
                        fillOpacity: 0.1,
                        strokeColor: '#007AFF',
                        strokeWeight: 3,
                        strokeOpacity: 1,
                        zIndex: 100
                      })
                    })
                  }
                  
                  // 선택된 시/군/구가 다른 곳에 있으면 그 스타일도 명시적으로 유지
                  if (selectedCityRef.current && selectedCityRef.current !== sigunguName && sigunguPolygonGroupsRef.current[selectedCityRef.current]) {
                    sigunguPolygonGroupsRef.current[selectedCityRef.current].forEach((poly: any) => {
                      poly.setOptions({
                        fillColor: '#007AFF',
                        fillOpacity: 0.1,
                        strokeColor: '#007AFF',
                        strokeWeight: 3,
                        strokeOpacity: 1,
                        zIndex: 100
                      })
                    })
                  }
                  
                  activePolygonNameRef.current = null
                }
                      if (sigunguOverlayRef.current) {
                  sigunguOverlayRef.current.close()
                        currentTooltipNameRef.current = null
                      }
                      mouseoutTimeoutRef.current = null
              }, 50) as unknown as number
            })

            window.naver.maps.Event.addListener(detailPolygon, 'click', function() {
              // 툴팁 닫기
              if (sigunguOverlayRef.current) {
                sigunguOverlayRef.current.close()
                currentTooltipNameRef.current = null
              }
              
              // 선택된 시/군/구 설정
                    setSelectedCity(sigunguName)
                    
              // 해당 시/군/구 확대 (클릭 시에만)
              const bounds = new window.naver.maps.LatLngBounds()
                    polygonPath.forEach((latlng: any) => bounds.extend(latlng))
              mapRef.current.fitBounds(bounds, { padding: 50 })
              
              // 선택된 시/군/구 강조, 다른 시/군/구는 원래 스타일 유지
              Object.entries(sigunguPolygonGroupsRef.current).forEach(([name, polys]) => {
                if (name === sigunguName) {
                  // 선택된 시/군/구: 파란색 테두리 두껍게, 배경 약간 강조
                  polys.forEach((poly: any) => {
                    poly.setOptions({
                      fillColor: '#007AFF',
                      fillOpacity: 0.1,
                      strokeColor: '#007AFF',
                      strokeWeight: 3,
                      strokeOpacity: 1,
                      zIndex: 100
                    })
                  })
                } else {
                  // 다른 시/군/구: 원래 스타일 유지 (경계선 명확하게 보이도록)
                  polys.forEach((poly: any) => {
                    poly.setOptions({
                      fillColor: '#007AFF',
                      fillOpacity: 0.02,
                      strokeColor: '#007AFF',
                      strokeWeight: 1,
                      strokeOpacity: 0.35,
                      zIndex: 50
                    })
                  })
                }
              })
                  })

                  detailPolygonsRef.current.push(detailPolygon)
          }
          
          if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polygon: any) => {
              const outerRing = polygon[0]
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 5 === 0)
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
                new window.naver.maps.LatLng(coord[1], coord[0])
              )
              if (polygonPath.length >= 3) {
                createDetailPolygon(polygonPath)
                }
              })
            } else if (geometry.type === 'Polygon') {
              const outerRing = geometry.coordinates[0]
              const simplifiedCoords = outerRing.filter((_: any, i: number) => i % 5 === 0)
              const polygonPath = simplifiedCoords.map((coord: number[]) => 
              new window.naver.maps.LatLng(coord[1], coord[0])
              )
              if (polygonPath.length >= 3) {
              createDetailPolygon(polygonPath)
            }
          }
        })
      })
      .catch(() => {})

    // 마우스 위치 추적 (툴팁 표시용)
    const handleMouseMove = (e: any) => {
      if (e && e.coord) {
        mousePositionRef.current = {
          lat: e.coord.lat(),
          lng: e.coord.lng()
        }
      }
    }

    // 이전 리스너 제거
    if (mouseMoveListenerRef.current && mapRef.current && window.naver?.maps) {
      try {
        window.naver.maps.Event.removeListener(mapRef.current, 'mousemove', mouseMoveListenerRef.current)
        mouseMoveListenerRef.current = null
      } catch (err) {
        // 무시 (이미 제거되었을 수 있음)
        mouseMoveListenerRef.current = null
      }
    }

    // 새 리스너 등록
    if (mapRef.current && window.naver?.maps) {
      try {
        mouseMoveListenerRef.current = handleMouseMove
        window.naver.maps.Event.addListener(mapRef.current, 'mousemove', handleMouseMove)
      } catch (err) {
        console.error('마우스 이벤트 리스너 등록 중 오류:', err)
        mouseMoveListenerRef.current = null
      }
    }

    return () => {
      try {
        // 시/군/구 polygon 제거
        if (Array.isArray(detailPolygonsRef.current)) {
          detailPolygonsRef.current.forEach(polygon => {
            if (polygon && typeof polygon.setMap === 'function') {
              try {
                polygon.setMap(null)
              } catch (err) {
                console.error('Cleanup: Detail polygon 제거 중 오류:', err)
              }
            }
          })
        }
        detailPolygonsRef.current = []
        sigunguPolygonGroupsRef.current = {}
        
        // 툴팁 닫기 및 마커 정리
        if (sigunguOverlayRef.current) {
          try {
            if (typeof sigunguOverlayRef.current.close === 'function') {
              sigunguOverlayRef.current.close()
            }
          } catch (err) {
            console.error('Cleanup: 툴팁 닫기 중 오류:', err)
          }
          sigunguOverlayRef.current = null
        }
        if (sigunguTooltipMarkerRef.current) {
          try {
            if (typeof sigunguTooltipMarkerRef.current.setMap === 'function') {
              sigunguTooltipMarkerRef.current.setMap(null)
            }
          } catch (err) {
            console.error('Cleanup: 툴팁 마커 제거 중 오류:', err)
          }
          sigunguTooltipMarkerRef.current = null
        }
        currentTooltipNameRef.current = null
        activePolygonNameRef.current = null
        
                  if (mouseoutTimeoutRef.current) {
                    clearTimeout(mouseoutTimeoutRef.current)
                    mouseoutTimeoutRef.current = null
                  }
                  
        // 마우스 이벤트 리스너 제거 (ref에 저장된 리스너 사용)
        if (mouseMoveListenerRef.current && mapRef.current && window.naver?.maps) {
          try {
            window.naver.maps.Event.removeListener(mapRef.current, 'mousemove', mouseMoveListenerRef.current)
            mouseMoveListenerRef.current = null
          } catch (err) {
            // 무시 (이미 제거되었을 수 있음)
            mouseMoveListenerRef.current = null
          }
        }
      } catch (error) {
        console.error('Cleanup 중 오류 발생:', error)
      }
    }
  }, [showDetailMap, selectedRegion])

  // selectedCity 변경 시 ref 업데이트
  useEffect(() => {
    selectedCityRef.current = selectedCity
  }, [selectedCity])

  // selectedCity 변경 시 polygon 스타일 업데이트
  useEffect(() => {
    if (!showDetailMap || !mapRef.current || !window.naver?.maps || !selectedRegion) return
    if (detailPolygonsRef.current.length === 0) return

    if (selectedCity) {
      // 선택된 시/군/구 강조, 다른 시/군/구는 원래 스타일 유지
      try {
        Object.entries(sigunguPolygonGroupsRef.current).forEach(([name, polys]) => {
          if (Array.isArray(polys)) {
            polys.forEach((poly: any) => {
              if (poly && typeof poly.setOptions === 'function') {
                try {
                  if (name === selectedCity) {
                    // 선택된 시/군/구: 파란색 테두리 두껍게, 배경 약간 강조
                    poly.setOptions({
                      fillColor: '#007AFF',
                      fillOpacity: 0.1,
                      strokeColor: '#007AFF',
                      strokeWeight: 3,
                      strokeOpacity: 1,
                      zIndex: 100
                    })
                  } else {
                    // 다른 시/군/구: 원래 스타일 유지 (경계선 명확하게 보이도록)
                    poly.setOptions({
                      fillColor: '#007AFF',
                      fillOpacity: 0.02,
                      strokeColor: '#007AFF',
                      strokeWeight: 1,
                      strokeOpacity: 0.35,
                      zIndex: 50
                    })
                  }
                } catch (err) {
                  console.error('Polygon 스타일 업데이트 중 오류:', err)
                }
              }
            })
          }
        })
      } catch (error) {
        console.error('시/군/구 스타일 업데이트 중 오류:', error)
      }
    } else {
      // selectedCity가 null이면 모든 polygon을 원래대로 복원
      try {
        // sigunguPolygonGroupsRef를 통해 모든 polygon 복원
        Object.values(sigunguPolygonGroupsRef.current).forEach((polys) => {
          if (Array.isArray(polys)) {
            polys.forEach((poly: any) => {
              if (poly && typeof poly.setOptions === 'function') {
                try {
                  poly.setOptions({
                    fillColor: '#007AFF',
                    fillOpacity: 0.02,
                    strokeColor: '#007AFF',
                    strokeWeight: 1,
                    strokeOpacity: 0.35,
                    zIndex: 50
                  })
                } catch (err) {
                  console.error('Polygon 복원 중 오류:', err)
                }
              }
            })
          }
        })
        
        // detailPolygonsRef도 복원
        if (Array.isArray(detailPolygonsRef.current)) {
          detailPolygonsRef.current.forEach(polygon => {
            if (polygon && typeof polygon.setOptions === 'function') {
              try {
                polygon.setOptions({
                  fillColor: '#007AFF',
                  fillOpacity: 0.02,
                  strokeColor: '#007AFF',
                  strokeWeight: 1,
                  strokeOpacity: 0.35,
                  zIndex: 50
                })
              } catch (err) {
                console.error('Polygon 복원 중 오류:', err)
              }
            }
          })
        }
      } catch (error) {
        console.error('Polygon 복원 중 오류 발생:', error)
      }
    }
  }, [selectedCity, showDetailMap, selectedRegion])

  // 맞춤 추천 로드 (관심 종목 + 찜 기반 추천)
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!isAuthenticated || !user?.id || events.length === 0) {
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
        
        // 1. 맞춤 추천: 사용자의 관심 종목(user.interests) 기반
        const userInterests = (user.interests as Category[]) || []
        const interestBasedEvents: Event[] = []
        
        if (userInterests.length > 0) {
          // 관심 카테고리와 일치하는 행사만 필터링 (event.category와 직접 비교)
          interestBasedEvents.push(...activeEvents.filter(event => {
            return userInterests.includes(event.category)
          }))
          
          if (import.meta.env.DEV) {
            console.log('맞춤 추천 - 관심 종목:', userInterests)
            console.log('맞춤 추천 - 필터링된 행사 수:', interestBasedEvents.length)
          }
        } else {
          if (import.meta.env.DEV) {
            console.log('맞춤 추천 - 관심 종목이 설정되지 않음')
          }
        }
        
        // 2. 찜 추천: 찜한 종목 + 유사한 사용자들이 찜한 종목 기반
        const favoriteBasedEvents: Event[] = []
        const myFavorites = await FavoriteService.getMyFavorites()
        
        if (myFavorites.length > 0) {
          // 찜한 종목 추출
          const myFavoriteSports = [
            ...new Set(
              myFavorites
                .map((fav: any) => fav.sub_sport)
                .filter((sub: string | null) => sub !== null)
            )
          ]
          
          if (myFavoriteSports.length > 0) {
            try {
              // 사용자-종목 선호도 행렬 가져오기
              const { matrix, users, sports } = await FavoriteService.getUserSportMatrix()
              
              // 유사한 사용자 찾기
              const similarUsers = findSimilarUsers(Number(user.id), matrix, users, sports, 5)
              
              // 유사한 사용자들이 찜한 종목 추천
              const recommendedSportsList = recommendSportsFromSimilarUsers(
                similarUsers,
                matrix,
                sports,
                myFavoriteSports
              )
              
              // 상위 3개 추천 종목 선택
              const topRecommendedSports = recommendedSportsList.slice(0, 3).map((item: any) => item.sport)
              
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
        
        // 맞춤 추천 + 찜 추천 합치기 (중복 제거)
        const allRecommendedEvents = [
          ...interestBasedEvents,
          ...favoriteBasedEvents
        ]
        
        if (import.meta.env.DEV) {
          console.log('맞춤 추천 - 관심 종목 기반 행사 수:', interestBasedEvents.length)
          console.log('찜 추천 - 찜 기반 행사 수:', favoriteBasedEvents.length)
          console.log('전체 추천 행사 수 (중복 포함):', allRecommendedEvents.length)
        }
        
        // 중복 제거 (같은 event.id는 하나만)
        const uniqueRecommendedEvents = Array.from(
          new Map(allRecommendedEvents.map(event => [event.id, event])).values()
        )
        
        if (import.meta.env.DEV) {
          console.log('최종 추천 행사 수 (중복 제거 후):', uniqueRecommendedEvents.length)
        }
        
        // 추천 행사 전체 표시 (slice 제거)
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
  }, [isAuthenticated, user?.id, user?.interests, events])

  // 카테고리 옵션
  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    return ['all', ...SPORT_CATEGORIES.map(cat => cat.value)]
  }, [])

  // 필터링된 이벤트
  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return events
      .filter((event) => {
        const isActive = event.event_status !== 'inactive'
        const isNormal = !event.reports_state || event.reports_state === 'normal'
        const regionMatch = selectedRegion ? event.region === selectedRegion : true
        const cityMatch = selectedCity ? event.city === selectedCity : true
        const categoryMatch = categoryFilter === 'all' ? true : event.category === categoryFilter
        
        // 검색어 매칭: 제목, 설명, 도시, region 정보 포함
        const termMatch = term
          ? (() => {
              // region 정보 가져오기
              const regionInfo = REGION_INFO[event.region]
              const regionNames = regionInfo 
                ? `${regionInfo.name} ${regionInfo.shortName}`
                : event.region || ''
              
              const searchText = `${event.title} ${event.summary || ''} ${event.city} ${event.region} ${event.sub_region || ''} ${regionNames}`.toLowerCase()
              return searchText.includes(term)
            })()
          : true
        
        return isActive && isNormal && regionMatch && cityMatch && categoryMatch && termMatch
      })
      .slice(0, 50)
  }, [events, selectedRegion, selectedCity, categoryFilter, searchTerm])

  // 마커 제거 함수
  const clearMarkers = useCallback(() => {
    try {
      if (markerInfoWindowRef.current) {
        if (markerInfoWindowRef.current.close) {
          markerInfoWindowRef.current.close()
        }
        markerInfoWindowRef.current = null
      }
      markersRef.current.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null)
        }
      })
      markersRef.current = []
    } catch (error) {
      console.error('마커 제거 중 오류 발생:', error)
      markersRef.current = []
    }
  }, [])

  // 마커 생성 함수 (메모이제이션)
  const createMarkers = useCallback((eventsToShow: Event[]) => {
    if (!mapRef.current || !window.naver?.maps) return

    // 기존 마커 직접 제거 (clearMarkers 함수 호출 대신)
    try {
      if (markerInfoWindowRef.current) {
        if (typeof markerInfoWindowRef.current.close === 'function') {
          markerInfoWindowRef.current.close()
        }
        markerInfoWindowRef.current = null
      }
      markersRef.current.forEach(marker => {
        if (marker && typeof marker.setMap === 'function') {
          marker.setMap(null)
        }
      })
      markersRef.current = []
    } catch (err) {
      console.error('마커 제거 중 오류:', err)
      markersRef.current = []
    }

    // 추천 행사 ID 목록 (빠른 조회를 위해 Set 사용)
    const recommendedEventIds = new Set(recommendedEvents.map(e => e.id))

    // 카테고리별 색상 (함수 밖에서 정의하여 재사용)
    const categoryColors: Record<string, string> = {
      'team-ball': '#FF6B6B',
      'racket-ball': '#4ECDC4',
      'martial-arts': '#45B7D1',
      'fitness-skill': '#96CEB4',
      'precision': '#FFEAA7',
      'ice-snow': '#74B9FF',
      'water': '#0984E3',
      'leisure': '#00B894',
      'mind': '#A29BFE',
      'other': '#FD79A8',
    }

    // 최대 30개 마커만 표시 (성능 최적화)
    const limitedEvents = eventsToShow.slice(0, 30)

    limitedEvents.forEach((event, index) => {
      // 이벤트에 실제 좌표가 있으면 사용, 없으면 지역 중심 좌표 + 오프셋 사용
      let position: any

      if (event.lat && event.lng) {
        position = new window.naver.maps.LatLng(event.lat, event.lng)
      } else {
        const regionCoords = REGION_COORDINATES[event.region]
        if (!regionCoords) return

        const angle = (index * 137.5) * (Math.PI / 180)
        const radius = 0.02 + (index * 0.008)
        const offsetLat = Math.cos(angle) * radius
        const offsetLng = Math.sin(angle) * radius
        position = new window.naver.maps.LatLng(
          regionCoords.lat + offsetLat,
          regionCoords.lng + offsetLng
        )
      }

      const isRecommended = recommendedEventIds.has(event.id)
      const markerColor = categoryColors[event.category] || '#007AFF'
      const emoji = SPORT_CATEGORIES.find(c => c.value === event.category)?.emoji || '📍'

      // 추천 행사는 별 모양, 일반 행사는 기존 핀 모양
      const markerContent = isRecommended
        ? `
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(255, 149, 0, 0.4), 0 0 0 2px rgba(255, 149, 0, 0.2);
            cursor: pointer;
            animation: pulse 2s ease-in-out infinite;
            position: relative;
          ">
            <span style="
              font-size: 18px;
              line-height: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              position: absolute;
              top: 0;
              left: 0;
            ">⭐</span>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(255, 149, 0, 0.4), 0 0 0 2px rgba(255, 149, 0, 0.2); }
              50% { transform: scale(1.1); box-shadow: 0 6px 16px rgba(255, 149, 0, 0.6), 0 0 0 4px rgba(255, 149, 0, 0.3); }
            }
          </style>
        `
        : `
          <div style="
            width: 32px;
            height: 32px;
            background: ${markerColor};
            border: 2px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
          ">
            <span style="transform: rotate(45deg); font-size: 14px; line-height: 1;">${emoji}</span>
          </div>
        `

      const marker = new window.naver.maps.Marker({
        position,
        map: mapRef.current,
        icon: {
          content: markerContent,
          anchor: isRecommended 
            ? new window.naver.maps.Point(20, 20) // 별 모양: 중앙
            : new window.naver.maps.Point(16, 32), // 핀 모양: 하단
        },
        zIndex: isRecommended ? 200 + index : 100 + index, // 추천 행사는 위에 표시
      })

      // 마커 클릭 이벤트
      window.naver.maps.Event.addListener(marker, 'click', () => {
        if (markerInfoWindowRef.current) {
          markerInfoWindowRef.current.close()
        }

        const infoContent = `
          <div style="padding: 16px; min-width: 240px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1d1d1f; line-height: 1.4;">${event.title}</h3>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b;">📍 ${REGION_INFO[event.region]?.shortName || ''} · ${event.city}</p>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="display: inline-block; padding: 4px 10px; background: ${markerColor}20; color: ${markerColor}; border-radius: 12px; font-size: 12px; font-weight: 500;">${CATEGORY_LABELS[event.category]}</span>
              <a href="/events/${event.id}" style="margin-left: auto; padding: 6px 12px; background: #007AFF; color: white; border-radius: 8px; font-size: 12px; font-weight: 500; text-decoration: none;">상세보기</a>
            </div>
          </div>
        `

        const infoWindow = new window.naver.maps.InfoWindow({
          content: infoContent,
          backgroundColor: 'white',
          borderColor: 'transparent',
          borderWidth: 0,
          anchorSize: new window.naver.maps.Size(0, 0),
          pixelOffset: new window.naver.maps.Point(0, -10),
        })

        infoWindow.open(mapRef.current, marker)
        markerInfoWindowRef.current = infoWindow
      })

      markersRef.current.push(marker)
    })
  }, [recommendedEvents])

  // filteredEvents의 ID 목록을 메모이제이션하여 불필요한 리렌더 방지
  const filteredEventIds = useMemo(() => 
    filteredEvents.map(e => e.id).join(','), 
    [filteredEvents]
  )

  // 이벤트 마커 표시 (showDetailMap이 true일 때만)
  useEffect(() => {
    if (!showDetailMap) {
      // 마커 직접 제거 (clearMarkers 함수 호출 대신)
      try {
        if (markerInfoWindowRef.current) {
          if (typeof markerInfoWindowRef.current.close === 'function') {
            markerInfoWindowRef.current.close()
          }
          markerInfoWindowRef.current = null
        }
        markersRef.current.forEach(marker => {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null)
          }
        })
        markersRef.current = []
      } catch (err) {
        console.error('마커 제거 중 오류:', err)
      }
      return
    }

    // 약간의 딜레이를 주어 지도 렌더링 후 마커 생성
    const timeoutId = setTimeout(() => {
      if (typeof createMarkers === 'function') {
        createMarkers(filteredEvents)
      }
    }, 150)

    return () => {
      clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailMap, filteredEventIds, createMarkers])

  // 필터 초기화
  const resetFilters = useCallback(() => {
    try {
      // 마커 먼저 제거 (직접 제거하여 의존성 문제 방지)
      try {
        if (markerInfoWindowRef.current) {
          if (typeof markerInfoWindowRef.current.close === 'function') {
            markerInfoWindowRef.current.close()
          }
          markerInfoWindowRef.current = null
        }
        markersRef.current.forEach(marker => {
          if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null)
          }
        })
        markersRef.current = []
      } catch (err) {
        console.error('마커 제거 중 오류:', err)
      }
      
    setSelectedRegion(null)
    setSelectedCity(null)
      selectedCityRef.current = null
    setShowDetailMap(false)
    setCategoryFilter('all')
    setSearchTerm('')
      
      try {
    dispatch({ type: 'CLEAR_FILTERS' })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
      } catch (err) {
        console.error('Dispatch 중 오류:', err)
      }
      
      // 시/군/구 polygon 그룹 초기화
      sigunguPolygonGroupsRef.current = {}
      
      // 툴팁 닫기 및 마커 정리
      if (sigunguOverlayRef.current) {
        try {
          if (typeof sigunguOverlayRef.current.close === 'function') {
            sigunguOverlayRef.current.close()
          }
        } catch (err) {
          console.error('툴팁 닫기 중 오류:', err)
        }
        sigunguOverlayRef.current = null
      }
      if (sigunguTooltipMarkerRef.current) {
        try {
          if (typeof sigunguTooltipMarkerRef.current.setMap === 'function') {
            sigunguTooltipMarkerRef.current.setMap(null)
          }
        } catch (err) {
          console.error('툴팁 마커 제거 중 오류:', err)
        }
        sigunguTooltipMarkerRef.current = null
      }
      currentTooltipNameRef.current = null
      activePolygonNameRef.current = null
      
      if (mouseoutTimeoutRef.current) {
        clearTimeout(mouseoutTimeoutRef.current)
        mouseoutTimeoutRef.current = null
      }
      
      if (mapRef.current && window.naver?.maps) {
        try {
          const moveLatLon = new window.naver.maps.LatLng(36.5, 125.5)
          if (typeof mapRef.current.setCenter === 'function') {
            mapRef.current.setCenter(moveLatLon)
          }
          if (typeof mapRef.current.setZoom === 'function') {
            mapRef.current.setZoom(7)
          }
        } catch (err) {
          console.error('지도 초기화 중 오류:', err)
        }
      }
      
      // 시/군/구 polygon 제거
      if (Array.isArray(detailPolygonsRef.current)) {
        detailPolygonsRef.current.forEach(polygon => {
          if (polygon && typeof polygon.setMap === 'function') {
            try {
              polygon.setMap(null)
            } catch (err) {
              console.error('Detail polygon 제거 중 오류:', err)
            }
          }
        })
      }
      detailPolygonsRef.current = []
      
      // 지역 polygon 복원
      if (Array.isArray(polygonsRef.current)) {
        polygonsRef.current.forEach((item) => {
          if (item && item.polygon) {
            const polygon = item.polygon
            if (polygon && typeof polygon.setMap === 'function' && mapRef.current) {
              try {
      polygon.setMap(mapRef.current)
                if (typeof polygon.setOptions === 'function') {
      polygon.setOptions({ 
                    fillColor: '#007AFF', 
                    fillOpacity: 0.06,
                    strokeColor: '#007AFF',
                    strokeOpacity: 0.5,
                    strokeWeight: 1.5
                  })
                }
              } catch (err) {
                console.error('Polygon 복원 중 오류:', err)
              }
            }
          }
        })
      }
    } catch (error) {
      console.error('초기화 중 오류 발생:', error)
    }
  }, [dispatch])

  // 카테고리 변경
  const handleCategoryChange = useCallback((option: CategoryFilter) => {
    setCategoryFilter(option)
    const nextCategory = option === 'all' ? null : option
    if (state.selectedCategory !== nextCategory) {
      dispatch({ type: 'SELECT_CATEGORY', payload: nextCategory })
    }
  }, [state.selectedCategory, dispatch])

  // 뒤로가기
  const handleBack = useCallback(() => {
    try {
                      if (selectedCity) {
                        setSelectedCity(null)
        selectedCityRef.current = null
        
        // 시/군/구 polygon 스타일 원래대로 복원
        if (Array.isArray(detailPolygonsRef.current)) {
          detailPolygonsRef.current.forEach(polygon => {
            if (polygon && typeof polygon.setOptions === 'function') {
              try {
                polygon.setOptions({
                  fillColor: '#007AFF',
                  fillOpacity: 0.02,
                  strokeColor: '#007AFF',
                  strokeWeight: 1,
                  strokeOpacity: 0.35,
                  zIndex: 1
                })
              } catch (err) {
                console.error('Polygon 스타일 복원 중 오류:', err)
              }
            }
          })
        }
        
        if (mapRef.current && selectedRegion && REGION_COORDINATES[selectedRegion] && window.naver?.maps) {
                          const coords = REGION_COORDINATES[selectedRegion]
          const isMetropolitan = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'].includes(selectedRegion)
          // 사이드바를 피해 오른쪽 중간에 위치하도록 경도 조정
          // 광역시/특별시는 작은 지역이므로 작게 조정, 도는 큰 지역이므로 크게 조정
          const adjustedLng = isMetropolitan ? coords.lng - 0.2 : coords.lng - 1.2
          mapRef.current.setCenter(new window.naver.maps.LatLng(coords.lat, adjustedLng))
          mapRef.current.setZoom(isMetropolitan ? 11 : 9)
                        }
                      } else {
        // 시/군/구 polygon 먼저 제거 (setShowDetailMap 호출 전)
        if (Array.isArray(detailPolygonsRef.current)) {
          detailPolygonsRef.current.forEach(polygon => {
            if (polygon && typeof polygon.setMap === 'function') {
              try {
                polygon.setMap(null)
              } catch (err) {
                console.error('Detail polygon 제거 중 오류:', err)
              }
            }
          })
        }
        detailPolygonsRef.current = []
        sigunguPolygonGroupsRef.current = {}
        
        // 툴팁 닫기
        if (sigunguOverlayRef.current) {
          try {
            if (typeof sigunguOverlayRef.current.close === 'function') {
              sigunguOverlayRef.current.close()
            }
          } catch (err) {
            console.error('툴팁 닫기 중 오류:', err)
          }
          sigunguOverlayRef.current = null
        }
        currentTooltipNameRef.current = null
        activePolygonNameRef.current = null
        
        if (mouseoutTimeoutRef.current) {
          clearTimeout(mouseoutTimeoutRef.current)
          mouseoutTimeoutRef.current = null
        }
        
                        setShowDetailMap(false)
                        setSelectedRegion(null)
                        dispatch({ type: 'SELECT_REGION', payload: null })
                        
        if (mapRef.current && window.naver?.maps) {
          try {
            mapRef.current.setCenter(new window.naver.maps.LatLng(36.5, 125.5))
            mapRef.current.setZoom(7)
          } catch (err) {
            console.error('지도 초기화 중 오류:', err)
          }
        }
        
        if (Array.isArray(polygonsRef.current)) {
          polygonsRef.current.forEach((item) => {
            if (item && item.polygon) {
              const polygon = item.polygon
              if (polygon && typeof polygon.setMap === 'function' && mapRef.current) {
                try {
                  polygon.setMap(mapRef.current)
                  if (typeof polygon.setOptions === 'function') {
                    polygon.setOptions({ 
                      fillColor: '#007AFF', 
                      fillOpacity: 0.06,
                      strokeColor: '#007AFF',
                      strokeOpacity: 0.5,
                      strokeWeight: 1.5
                    })
                  }
                } catch (err) {
                  console.error('Polygon 복원 중 오류:', err)
                }
              }
            }
          })
        }
      }
    } catch (error) {
      console.error('뒤로가기 중 오류 발생:', error)
    }
  }, [selectedCity, selectedRegion, dispatch])

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* 풀스크린 지도 배경 */}
      <div className="absolute inset-0">
        {!naverMapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f5f5f7] via-[#e8e8ed] to-[#d2d2d7]">
            {/* Apple 스타일 로딩 */}
            <div className="text-center">
              <div className="relative mx-auto mb-6 h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#007AFF]/20"></div>
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#007AFF]"></div>
              </div>
              <p className="text-[15px] font-medium text-[#86868b] tracking-tight">지도를 불러오는 중...</p>
            </div>
          </div>
              )}
              <div 
                ref={mapContainerRef}
          className="h-full w-full"
              />
              </div>
              
      {/* 모바일 사이드바 토글 */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] active:scale-95 lg:hidden"
        style={{ WebkitBackdropFilter: 'blur(20px)' }}
      >
        {sidebarOpen ? (
          <X className="h-5 w-5 text-[#1d1d1f]" />
        ) : (
          <Filter className="h-5 w-5 text-[#1d1d1f]" />
        )}
      </button>

      {/* Glassmorphism 사이드바 */}
      <aside 
        className={`absolute left-0 top-0 z-20 h-full w-full transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:left-5 lg:top-5 lg:h-[calc(100%-40px)] lg:w-[420px] lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div 
          className="flex h-full flex-col bg-white/95 backdrop-blur-3xl lg:rounded-[28px] lg:shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] lg:border lg:border-white/40"
          style={{ WebkitBackdropFilter: 'blur(60px)' }}
        >
          {/* 헤더 영역 */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4">
            {/* 로고 */}
            <button
              onClick={() => navigate('/')}
              className="mb-4 flex items-center transition-opacity hover:opacity-80 active:scale-[0.98]"
            >
              <img 
                src="/images/logo.png" 
                alt="어디서하니" 
                className="h-8 w-auto"
              />
            </button>
            
            {/* 검색바 - Apple 스타일 */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8e8e93]" />
              <input
                type="text"
                placeholder="행사 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-[14px] bg-[#767680]/10 py-[11px] pl-11 pr-11 text-[17px] text-[#1d1d1f] placeholder-[#8e8e93] outline-none transition-all duration-200 focus:bg-[#767680]/15 focus:ring-2 focus:ring-[#007AFF]/30"
                style={{ letterSpacing: '-0.01em' }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#8e8e93]/30 p-1 transition-colors hover:bg-[#8e8e93]/40"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              )}
            </div>

            {/* 지역 네비게이션 */}
            <div className="mt-5 flex items-center justify-between">
              {showDetailMap && selectedRegion ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 rounded-full bg-[#007AFF]/10 px-4 py-2 text-[15px] font-semibold text-[#007AFF] transition-all duration-200 hover:bg-[#007AFF]/15 active:scale-[0.97]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{selectedCity || REGION_INFO[selectedRegion]?.shortName || '뒤로'}</span>
                </button>
              ) : (
                <h2 className="text-[22px] font-bold text-[#1d1d1f] tracking-tight">전국</h2>
              )}
              
              {(selectedRegion || categoryFilter !== 'all' || searchTerm) && (
                <button
                  onClick={resetFilters}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#007AFF] transition-all duration-200 hover:bg-[#007AFF]/10 active:scale-[0.97]"
                >
                  초기화
                </button>
              )}
            </div>
        </div>

          {/* 카테고리 칩 - 가로 스크롤 */}
          <div className="flex-shrink-0 border-t border-[#3c3c43]/10 px-6 py-4">
            <div 
              className="category-scroll flex gap-2 overflow-x-auto pb-1"
              onMouseDown={(e) => {
                // 왼쪽 마우스 버튼만 처리
                if (e.button !== 0) return
                
                const target = e.currentTarget
                const startX = e.pageX
                const startScrollLeft = target.scrollLeft
                
                const handleMouseMove = (e: MouseEvent) => {
                  const deltaX = Math.abs(e.pageX - startX)
                  if (deltaX > 3) {
                    categoryScrollDraggingRef.current = true
                    e.preventDefault()
                    const walk = (e.pageX - startX) * 1
                    target.scrollLeft = startScrollLeft - walk
                  }
                }
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                  
                  // 드래그가 끝난 후 약간의 지연 후 드래그 상태 해제
                  setTimeout(() => {
                    categoryScrollDraggingRef.current = false
                  }, 100)
                }
                
                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
              }}
            >
              {categoryOptions.map((option) => {
                const categoryInfo = option === 'all' 
                  ? { label: '전체', emoji: '🌐' }
                  : SPORT_CATEGORIES.find(cat => cat.value === option)
                const isActive = categoryFilter === option
                
                return (
                <button
                  key={option}
                    onClick={(e) => {
                      // 드래그 중이면 클릭 이벤트 방지
                      if (categoryScrollDraggingRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                        return
                      }
                      handleCategoryChange(option)
                    }}
                    className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-[9px] text-[15px] font-medium transition-all duration-200 active:scale-[0.97] ${
                      isActive
                        ? 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.35)]'
                        : 'bg-[#767680]/10 text-[#1d1d1f] hover:bg-[#767680]/15'
                    }`}
                  >
                    <span className="text-[14px]">{categoryInfo?.emoji}</span>
                    <span>{categoryInfo?.label || CATEGORY_LABELS[option]}</span>
                </button>
                )
              })}
            </div>
          </div>

          {/* 맞춤 추천 섹션 */}
          {isAuthenticated && recommendedEvents.length > 0 && (
            <div className="flex-shrink-0 border-t border-[#3c3c43]/10 px-6 py-4">
              <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-[#FF9500]" fill="currentColor" />
                <span className="text-[15px] font-semibold text-[#1d1d1f]">맞춤 추천</span>
                <span className="ml-auto rounded-full bg-[#FF9500]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#FF9500]">
                  {recommendedEvents.length}
                </span>
            </div>
              <div className="recommended-scroll max-h-[240px] overflow-y-auto space-y-2">
                {recommendedEvents.map((event) => (
                  <a
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="group block rounded-2xl bg-gradient-to-r from-[#FF9500]/8 to-transparent p-3.5 transition-all duration-200 hover:from-[#FF9500]/12"
                  >
                    <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1 transition-colors group-hover:text-[#007AFF]">
                      {event.title}
                    </h4>
                    <p className="mt-1 text-[13px] text-[#8e8e93]">
                      {REGION_INFO[event.region]?.shortName} · {event.city}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 이벤트 리스트 */}
          <div className="flex-1 overflow-hidden border-t border-[#3c3c43]/10">
            <div className="flex h-full flex-col">
              {/* 리스트 헤더 */}
              <div className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#007AFF]/10">
                    <Calendar className="h-3.5 w-3.5 text-[#007AFF]" />
                  </div>
                  <span className="text-[15px] font-semibold text-[#1d1d1f]">행사 목록</span>
                </div>
                <span className="rounded-full bg-[#767680]/10 px-2.5 py-1 text-[12px] font-semibold text-[#8e8e93]">
                  {filteredEvents.length}건
                </span>
              </div>
              
            {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="relative mx-auto mb-4 h-10 w-10">
                      <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#007AFF]/20"></div>
                      <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#007AFF]"></div>
                    </div>
                    <p className="text-[14px] text-[#8e8e93]">불러오는 중...</p>
                  </div>
              </div>
            ) : (
                <div className="recommended-scroll flex-1 overflow-y-auto px-6 pb-6">
                  {filteredEvents.length > 0 ? (
                    <div className="space-y-3">
                      {filteredEvents.map((event) => (
                        <a
                          key={event.id}
                              href={`/events/${event.id}`}
                          className="group block overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]"
                        >
                          <div className="flex gap-4">
                            {/* 썸네일 */}
                            <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-2xl bg-[#f5f5f7]">
                              {event.image ? (
                                <img 
                                  src={event.image} 
                                  alt={event.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-2xl bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed]">
                                  {SPORT_CATEGORIES.find(c => c.value === event.category)?.emoji || '🏆'}
                                </div>
                              )}
                            </div>
                            
                            {/* 정보 */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-2 leading-snug transition-colors group-hover:text-[#007AFF]">
                            {event.title}
                              </h4>
                              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#8e8e93]">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="truncate">{REGION_INFO[event.region]?.shortName} · {event.city}</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f]">
                                  {CATEGORY_LABELS[event.category]}
                          </span>
                                <ChevronRight className="h-4 w-4 text-[#c7c7cc] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#007AFF]" />
                          </div>
                        </div>
                        </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center py-16">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f7]">
                          <Calendar className="h-8 w-8 text-[#c7c7cc]" />
                        </div>
                        <p className="text-[17px] font-semibold text-[#1d1d1f]">행사가 없습니다</p>
                        <p className="mt-1 text-[15px] text-[#8e8e93]">다른 조건으로 검색해보세요</p>
                      </div>
                    </div>
                  )}
            </div>
            )}
            </div>
          </div>
          </div>
        </aside>

      {/* 지역 정보 플로팅 배지 (데스크탑) */}
      {showDetailMap && selectedRegion && (
        <div className="absolute right-5 top-5 z-10 hidden lg:block">
          <div 
            className="flex items-center gap-3 rounded-full bg-white/80 backdrop-blur-xl px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.1)]"
            style={{ WebkitBackdropFilter: 'blur(20px)' }}
          >
            <span className="text-xl">{REGION_INFO[selectedRegion]?.emoji}</span>
            <span className="text-[15px] font-semibold text-[#1d1d1f] tracking-tight">
              {selectedCity || REGION_INFO[selectedRegion]?.name}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
