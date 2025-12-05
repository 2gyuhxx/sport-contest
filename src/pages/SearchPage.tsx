import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { ArrowLeft, X, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import type { Event } from '../types/events'
import { SPORT_CATEGORIES, REGION_INFO, REGION_COORDINATES, CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../constants'
import { KOREA_REGION_PATHS } from '../data/koreaRegionPaths'
import { useEventFilters, type CategoryFilter } from '../hooks/useEventFilters'
import { useNaverMap } from '../hooks/useNaverMap'
import { SearchBar } from '../components/SearchBar'
import { CategoryChips } from '../components/CategoryChips'
import { RecommendedSection } from '../components/RecommendedSection'
import { EventListSection } from '../components/EventListSection'
import '../types/naver.d.ts'

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: '전체',
  ...CATEGORY_LABEL_MAP,
}

export function SearchPage() {
  const navigate = useNavigate()
  const { state, dispatch, isLoading } = useEventContext()
  const { events } = state
  const { state: authState } = useAuthContext()
  const { user, isAuthenticated } = authState

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = state?.selectedCategory ?? 'all'
  const initialKeyword = state?.keyword ?? ''

  // Custom Hooks
  const { mapRef, mapContainerRef, naverMapsLoaded, naverMapsError, initializeMap } = useNaverMap()
  const {
    selectedRegion,
    setSelectedRegion,
    categoryFilter,
    searchTerm,
    setSearchTerm,
    filteredEvents,
    recommendedEvents,
    categoryOptions,
    handleCategoryChange,
    resetFilters: resetEventFilters
  } = useEventFilters({
    events,
    isAuthenticated,
    userId: user?.id,
    userInterests: user?.interests,
    initialRegion,
    initialCategory,
    initialKeyword
  })

  // 지도 관련 ref (polygon 관리용)
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

  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showDetailMap, setShowDetailMap] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 지도 초기화 (useNaverMap hook 사용)
  useEffect(() => {
    if (!naverMapsLoaded || !mapContainerRef.current || mapRef.current) return

    initializeMap((map) => {
      // 지역 Polygon 생성
      initializeRegionPolygons(map)
    })
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

        ; (polygon as any)._originalOpacity = 0.06
        ; (polygon as any)._originalStrokeColor = '#007AFF'

      // 클릭 이벤트
      window.naver.maps.Event.addListener(polygon, 'click', function () {
        if (infowindowRef.current) infowindowRef.current.close()
        if (customOverlayRef.current) customOverlayRef.current.setMap(null)

        polygon.setOptions({ fillColor: '#007AFF', fillOpacity: 0.06 })

        const coords = REGION_COORDINATES[regionId]
        setSelectedRegion(regionId)
        setShowDetailMap(true)
        dispatch({ type: 'SELECT_REGION', payload: regionId })

        // Early Return: 지도가 준비되지 않았으면 종료
        if (!coords || !mapRef.current || !window.naver?.maps) return

        // 사이드바를 피해 오른쪽 중간에 위치하도록 경도 조정
        // 광역시/특별시는 작은 지역이므로 작게 조정, 도는 큰 지역이므로 크게 조정
        const adjustedLng = isMetropolitan ? coords.lng - 0.2 : coords.lng - 1.2
        const targetLatLng = new window.naver.maps.LatLng(coords.lat, adjustedLng)
        const zoom = isMetropolitan ? 11 : Math.max(8, Math.min(9, 14 - coords.level + 2))

        // 즉시 설정 (다른 로직보다 우선)
        mapRef.current.setCenter(targetLatLng)
        mapRef.current.setZoom(zoom)

        // 다른 로직이 실행된 후에도 지도 위치 유지
        setTimeout(() => {
          if (mapRef.current && window.naver?.maps) {
            mapRef.current.setCenter(targetLatLng)
            mapRef.current.setZoom(zoom)
          }
        }, 300)

        // 광역시가 속한 도 숨기기
        const METRO_TO_PROVINCE: Record<string, string> = {
          'gwangju': 'jeonnam',
          'daejeon': 'chungnam',
          'ulsan': 'gyeongnam',
        }
        // 역방향 매핑: 도 -> 광역시들
        const PROVINCE_TO_METROS: Record<string, string[]> = {
          'jeonnam': ['gwangju'],
          'chungnam': ['daejeon'],
          'gyeongnam': ['ulsan'],
        }
        const provinceToHide = METRO_TO_PROVINCE[regionId]
        const metrosToFade = PROVINCE_TO_METROS[regionId] || []

        polygonsRef.current.forEach(({ polygon: p, regionId: rid }) => {
          if (rid === regionId) {
            // 선택된 지역: 정상적으로 강조
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
            // 광역시가 속한 도: 숨기기
            p.setMap(null)
          } else if (metrosToFade.includes(rid)) {
            // 도가 선택되었을 때 그 안의 광역시: 흰색으로 흐려지게 (하지만 클릭 가능하도록 z-index 높게)
            p.setMap(mapRef.current)
            p.setOptions({
              fillColor: '#ffffff',
              fillOpacity: 0.75,
              strokeColor: '#9ca3af',
              strokeWeight: 1.5,
              strokeOpacity: 0.8,
              zIndex: 500  // 시/군/구 polygon(zIndex: 50)보다 높게 설정하여 클릭 가능하게
            })
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
      window.naver.maps.Event.addListener(polygon, 'mouseover', function () {
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
      window.naver.maps.Event.addListener(polygon, 'mouseout', function () {
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
    // 역방향 매핑: 도 -> 광역시들
    const PROVINCE_TO_METROS: Record<string, string[]> = {
      'jeonnam': ['gwangju'],
      'chungnam': ['daejeon'],
      'gyeongnam': ['ulsan'],
    }
    const provinceToHide = METRO_TO_PROVINCE[selectedRegion]
    const metrosToFade = PROVINCE_TO_METROS[selectedRegion] || []

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
      } else if (metrosToFade.includes(regionId)) {
        // 도가 선택되었을 때 그 안의 광역시: 흰색으로 흐려지게 (하지만 클릭 가능하도록 z-index 높게)
        polygon.setMap(mapRef.current)
        polygon.setOptions({
          fillColor: '#ffffff',
          fillOpacity: 0.75,
          strokeColor: '#9ca3af',
          strokeWeight: 1.5,
          strokeOpacity: 0.8,
          zIndex: 500  // 시/군/구 polygon(zIndex: 50)보다 높게 설정하여 클릭 가능하게
        })
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

        // 광역시가 속한 도의 코드도 가져오기
        const METRO_TO_PROVINCE: Record<string, string> = {
          'gwangju': 'jeonnam',
          'daejeon': 'chungnam',
          'ulsan': 'gyeongnam',
        }
        const parentProvince = METRO_TO_PROVINCE[selectedRegion]
        const parentProvinceCode = parentProvince ? REGION_CODE_MAP[parentProvince] : null

        geojson.features.forEach((feature: any) => {
          const sigunguName = feature.properties.name || feature.properties.SIG_KOR_NM || ''
          const sigunguCode = feature.properties.code || feature.properties.SIG_CD || feature.properties.CTPRVN_CD || ''

          // 선택된 지역의 시/군/구 또는 광역시가 속한 도의 시/군/구만 렌더링
          const isSelectedRegion = sigunguCode.startsWith(regionCode)
          const isParentProvince = parentProvinceCode && sigunguCode.startsWith(parentProvinceCode)

          if (!isSelectedRegion && !isParentProvince) return

          const geometry = feature.geometry

          // 선택된 지역이 광역시를 포함하는 도인지 확인
          const PROVINCE_TO_METROS: Record<string, string[]> = {
            'jeonnam': ['gwangju'],
            'chungnam': ['daejeon'],
            'gyeongnam': ['ulsan'],
          }
          const hasMetropolitanCity = PROVINCE_TO_METROS[selectedRegion]?.length > 0

          const createDetailPolygon = (polygonPath: any[]) => {
            // 부모 도의 시/군/구인 경우 흰색으로 흐려지게 표시
            const isFaded = isParentProvince && !isSelectedRegion

            const detailPolygon = new window.naver.maps.Polygon({
              map: mapRef.current,
              paths: polygonPath,
              strokeWeight: 1,
              strokeColor: isFaded ? '#9ca3af' : '#007AFF',
              strokeOpacity: isFaded ? 0.8 : 0.35,
              strokeStyle: 'solid',
              fillColor: isFaded ? '#ffffff' : '#007AFF',
              fillOpacity: isFaded ? 0.75 : 0.02,
              clickable: !hasMetropolitanCity && !isFaded,  // 광역시가 있는 도의 경우 또는 흐려진 경우 클릭 불가능
              zIndex: isFaded ? 5 : 50,  // 흐려진 polygon은 낮은 z-index
            })

            if (!sigunguPolygonGroupsRef.current[sigunguName]) {
              sigunguPolygonGroupsRef.current[sigunguName] = []
            }
            sigunguPolygonGroupsRef.current[sigunguName].push(detailPolygon)

            // 흐려진 polygon은 이벤트 리스너를 추가하지 않음
            if (isFaded) {
              detailPolygonsRef.current.push(detailPolygon)
              return
            }

            window.naver.maps.Event.addListener(detailPolygon, 'mouseover', function (e: any) {
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
              // 이벤트 객체에서 직접 좌표 가져오기
              const mousePosition = e.coord || e.latlng
              if (mousePosition && mapRef.current && window.naver?.maps) {
                try {

                  // 툴팁 마커 생성 또는 위치 업데이트 (지도 이동 방지)
                  if (!sigunguTooltipMarkerRef.current) {
                    try {
                      sigunguTooltipMarkerRef.current = new window.naver.maps.Marker({
                        position: mousePosition,
                        map: mapRef.current,
                        icon: {
                          content: '<div></div>', // 빈 문자열 대신 빈 div 사용
                          anchor: new window.naver.maps.Point(0, 0),
                        },
                        visible: false,
                        zIndex: 1000,
                      })
                    } catch (markerError) {
                      // 마커 생성 실패 시 무시
                      return
                    }
                  } else {
                    try {
                      sigunguTooltipMarkerRef.current.setPosition(mousePosition)
                    } catch (positionError) {
                      // 위치 설정 실패 시 마커 재생성 시도
                      try {
                        sigunguTooltipMarkerRef.current = new window.naver.maps.Marker({
                          position: mousePosition,
                          map: mapRef.current,
                          icon: {
                            content: '<div></div>',
                            anchor: new window.naver.maps.Point(0, 0),
                          },
                          visible: false,
                          zIndex: 1000,
                        })
                      } catch {
                        return
                      }
                    }
                  }

                  if (!sigunguOverlayRef.current) {
                    try {
                      sigunguOverlayRef.current = new window.naver.maps.InfoWindow({
                        content: `<div style="padding: 10px 16px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; color: #1d1d1f; white-space: nowrap; letter-spacing: -0.01em;">${sigunguName}</div>`,
                        disableAnchor: true,
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        pixelOffset: new window.naver.maps.Point(0, -15),
                      })
                    } catch (overlayError) {
                      // InfoWindow 생성 실패 시 무시
                      return
                    }
                  } else {
                    try {
                      sigunguOverlayRef.current.setContent(`<div style="padding: 10px 16px; background: rgba(255,255,255,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; color: #1d1d1f; white-space: nowrap; letter-spacing: -0.01em;">${sigunguName}</div>`)
                    } catch {
                      // 콘텐츠 설정 실패 시 무시
                    }
                  }

                  // 마커를 사용하여 툴팁 표시 (지도 이동 없이)
                  if (sigunguOverlayRef.current && sigunguTooltipMarkerRef.current) {
                    try {
                      sigunguOverlayRef.current.open(mapRef.current, sigunguTooltipMarkerRef.current)
                      currentTooltipNameRef.current = sigunguName
                    } catch (openError) {
                      // 툴팁 열기 실패 시 무시
                    }
                  }
                } catch (error) {
                  // 전체 에러 캐치 - 모든 에러를 조용히 처리
                }
              }
            })

            // 마우스가 polygon 위에서 움직일 때 툴팁 위치 업데이트
            window.naver.maps.Event.addListener(detailPolygon, 'mousemove', function (e: any) {
              // 현재 툴팁이 이 시/군/구에 대한 것인지 확인
              if (currentTooltipNameRef.current === sigunguName && sigunguTooltipMarkerRef.current && mapRef.current && window.naver?.maps) {
                try {
                  // 마우스 위치 가져오기
                  const mousePosition = e.coord || e.latlng
                  if (mousePosition) {
                    // 마커 위치 업데이트
                    sigunguTooltipMarkerRef.current.setPosition(mousePosition)
                    // InfoWindow도 다시 열어서 위치 업데이트
                    if (sigunguOverlayRef.current) {
                      sigunguOverlayRef.current.open(mapRef.current, sigunguTooltipMarkerRef.current)
                    }
                  }
                } catch (error) {
                  // 에러 무시
                }
              }
            })

            window.naver.maps.Event.addListener(detailPolygon, 'mouseout', function () {
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

            window.naver.maps.Event.addListener(detailPolygon, 'click', function () {
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
      .catch(() => { })

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

  // 완전 초기화 (필터 + 지도 상태)
  const handleReset = useCallback(() => {
    try {
      // 1. 이벤트 필터 초기화 (hook)
      resetEventFilters()

      // 2. 지도 관련 상태 초기화
      setSelectedCity(null)
      selectedCityRef.current = null
      setShowDetailMap(false)
      showDetailMapRef.current = false

      // 3. dispatch 초기화
      dispatch({ type: 'CLEAR_FILTERS' })
      dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })

      // 4. 마커 제거
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

      // 5. 시/군/구 polygon 제거  
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

      // 6. 툴팁 닫기
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

      // 7. 지도 위치 초기화
      if (mapRef.current && window.naver?.maps) {
        try {
          const moveLatLon = new window.naver.maps.LatLng(36.5, 127.5)
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

      // 8. 지역 polygon 스타일 복원
      if (Array.isArray(polygonsRef.current)) {
        polygonsRef.current.forEach((item) => {
          if (item && item.polygon) {
            const polygon = item.polygon
            const isMetropolitan = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan'].includes(item.regionId)
            if (polygon && typeof polygon.setMap === 'function' && mapRef.current) {
              try {
                polygon.setMap(mapRef.current)
                if (typeof polygon.setOptions === 'function') {
                  polygon.setOptions({
                    fillColor: '#007AFF',
                    fillOpacity: 0.06,
                    strokeColor: '#007AFF',
                    strokeOpacity: isMetropolitan ? 0.8 : 0.5,
                    strokeWeight: isMetropolitan ? 2 : 1.5,
                    zIndex: isMetropolitan ? 100 : 1
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
  }, [resetEventFilters, dispatch])

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* 풀스크린 지도 배경 */}
      <div className="absolute inset-0">
        {!naverMapsLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f5f5f7] via-[#e8e8ed] to-[#d2d2d7]">
            {/* Apple 스타일 로딩 또는 에러 메시지 */}
            <div className="text-center">
              {naverMapsError ? (
                <div className="px-6">
                  <p className="text-[15px] font-medium text-red-600 tracking-tight mb-2">
                    {naverMapsError}
                  </p>
                  <p className="text-[13px] text-[#86868b] tracking-tight">
                    네이버 클라우드 플랫폼 콘솔에서 API 키를 확인해주세요.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative mx-auto mb-6 h-12 w-12">
                    <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#007AFF]/20"></div>
                    <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#007AFF]"></div>
                  </div>
                  <p className="text-[15px] font-medium text-[#86868b] tracking-tight">지도를 불러오는 중...</p>
                </>
              )}
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
        className={`absolute left-0 top-0 z-20 h-full w-full transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:left-5 lg:top-5 lg:h-[calc(100%-40px)] lg:w-[420px] lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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

            {/* 검색바 - SearchBar 컴포넌트 */}
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />

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
                  onClick={handleReset}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#007AFF] transition-all duration-200 hover:bg-[#007AFF]/10 active:scale-[0.97]"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {/* 카테고리 칩 - CategoryChips 컴포넌트 */}
          <CategoryChips
            categoryOptions={categoryOptions}
            selectedCategory={categoryFilter}
            onCategoryChange={handleCategoryChange}
          />

          {/* 맞춤 추천 섹션 - RecommendedSection 컴포넌트 */}
          <RecommendedSection
            events={recommendedEvents}
            isAuthenticated={isAuthenticated}
          />

          {/* 이벤트 리스트 - EventListSection 컴포넌트 */}
          <EventListSection
            events={filteredEvents}
            isLoading={isLoading}
          />
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
