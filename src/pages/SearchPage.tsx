import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Calendar, X, ArrowLeft } from 'lucide-react'
import { useEventContext } from '../context/useEventContext'
import type { Category, Event } from '../types/events'
import { formatDate } from '../utils/formatDate'
import { CATEGORY_LABELS as CATEGORY_LABEL_MAP } from '../utils/categoryLabels'
import { KOREA_REGION_PATHS } from '../data/koreaRegionPaths'
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
  
  // 시/군/구 경계선 ref
  const detailPolygonsRef = useRef<any[]>([])

  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showDetailMap, setShowDetailMap] = useState(false)

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = (state?.selectedCategory ?? 'all') as CategoryFilter
  const initialKeyword = state?.keyword ?? ''

  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
  const [searchTerm, setSearchTerm] = useState(initialKeyword)

  // Polygon과 CustomOverlay ref
  const polygonsRef = useRef<{ polygon: any; regionId: string }[]>([])
  const customOverlayRef = useRef<any>(null) // 시/도용 CustomOverlay
  const sigunguOverlayRef = useRef<any>(null) // 시/군/구용 CustomOverlay
  const koreaBoundsRef = useRef<any>(null) // 대한민국 경계 저장
  const [kakaoMapsLoaded, setKakaoMapsLoaded] = useState(false)

  // 카카오맵 SDK 로드 확인 (index.html에서 정적으로 로드됨)
  useEffect(() => {
    console.log('[카카오맵] SDK 로드 확인 시작', {
      hasKakao: !!window.kakao,
      hasMaps: !!window.kakao?.maps,
      hasLatLng: !!window.kakao?.maps?.LatLng,
      scriptExists: !!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk.js"]')
    })
    
    // 스크립트 요소 찾기
    const scriptElement = document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk.js"]') as HTMLScriptElement
    
    // LatLng 생성자가 사용 가능할 때까지 대기
    let attemptCount = 0
    const maxAttempts = 300 // 15초 (50ms * 300)
    let checkInterval: number | null = null
    
    const checkReady = () => {
      attemptCount++
      
      // window.kakao.maps가 있는지 확인 (maps 객체가 초기화되었는지)
      if (window.kakao?.maps && window.kakao.maps.LatLng && typeof window.kakao.maps.LatLng === 'function') {
        console.log('[카카오맵] SDK 초기화 완료 (LatLng 생성자 확인됨)', { attemptCount })
        if (checkInterval) clearInterval(checkInterval)
        setKakaoMapsLoaded(true)
      } else if (attemptCount < maxAttempts) {
        // 아직 준비되지 않았으면 계속 확인
        // 이미 interval이 설정되어 있으면 스킵
        if (!checkInterval) {
          checkInterval = setInterval(checkReady, 50)
        }
      } else {
        // 타임아웃
        if (checkInterval) clearInterval(checkInterval)
        console.error('[카카오맵] SDK LatLng 생성자 초기화 타임아웃', {
          attemptCount,
          hasKakao: !!window.kakao,
          hasMaps: !!window.kakao?.maps,
          hasLatLng: !!window.kakao?.maps?.LatLng,
          scriptExists: !!scriptElement,
          scriptSrc: scriptElement?.src,
          kakaoKeys: window.kakao ? Object.keys(window.kakao) : []
        })
        
        // 카카오 객체가 있지만 maps가 없는 경우 - API 키나 도메인 문제일 수 있음
        if (window.kakao && !window.kakao.maps) {
          console.error('[카카오맵] window.kakao는 있지만 maps 객체가 없습니다. API 키 또는 도메인 설정을 확인하세요.')
        }
      }
    }
    
    // 스크립트 로드 완료 이벤트 리스너 추가
    if (scriptElement) {
      scriptElement.addEventListener('load', () => {
        console.log('[카카오맵] 스크립트 onload 이벤트 발생')
        // SDK 초기화를 위해 약간의 지연
        setTimeout(() => {
          console.log('[카카오맵] onload 후 window.kakao 상태:', {
            hasKakao: !!window.kakao,
            hasMaps: !!window.kakao?.maps,
            kakaoKeys: window.kakao ? Object.keys(window.kakao) : []
          })
          checkReady()
        }, 200)
      })
      scriptElement.addEventListener('error', (e) => {
        console.error('[카카오맵] 스크립트 로드 에러', e)
        console.error('[카카오맵] 스크립트 src:', scriptElement.src)
        if (checkInterval) clearInterval(checkInterval)
      })
      // 즉시 한 번 체크 (이미 로드된 경우 대비)
      // 약간의 지연을 두고 체크 (스크립트가 방금 추가되었을 수 있음)
      setTimeout(() => checkReady(), 100)
    } else {
      // 스크립트가 없는 경우 - 동적 로드 시도
      console.warn('[카카오맵] 스크립트 태그를 찾을 수 없습니다. 동적 로드를 시도합니다.')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=76ed4671868b9a59aa14bd765c1dd98d&libraries=services,clusterer'
      script.onload = () => {
        console.log('[카카오맵] 동적 로드 완료')
        setTimeout(() => checkReady(), 100)
      }
      script.onerror = (e) => {
        console.error('[카카오맵] 동적 로드 실패', e)
      }
      document.head.appendChild(script)
      checkReady()
    }
    
    return () => {
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [])

  // 카카오맵 초기화
  useEffect(() => {
    if (!mapContainerRef.current || !kakaoMapsLoaded) return
    
    // LatLng 생성자가 사용 가능한지 확인
    if (!window.kakao?.maps?.LatLng || typeof window.kakao.maps.LatLng !== 'function') {
      console.warn('[카카오맵] LatLng 생성자가 아직 준비되지 않음')
      return
    }

    console.log('[카카오맵] SDK 로드 완료, 지도 초기화 시작')
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
    })
    
    // CustomOverlay 생성 (시/군/구용)
    sigunguOverlayRef.current = new window.kakao.maps.CustomOverlay({
      yAnchor: 1,
    })

    // 대한민국 외 모든 지역 가리기 (바다, 북한, 주변국 포함)
    const overlayColor = '#FFF3E0'
    
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
          strokeWeight: 0,
          fillColor: overlayColor,
          fillOpacity: 1.0,
        })
        
        console.log('[대한민국 외 지역 가리기] 완료:', koreaHoles.length, '개 구멍')
        console.log('[대한민국 경계]:', { minLat, maxLat, minLng, maxLng })
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
        strokeColor: '#4F46E5',
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
        fillColor: '#fff',
        fillOpacity: 0.4,
      })

      // mouseover 이벤트
      window.kakao.maps.event.addListener(polygon, 'mouseover', function(mouseEvent: any) {
        polygon.setOptions({ fillColor: '#818CF8', fillOpacity: 0.7 })
        const content = `<div style="padding: 8px 12px; background: white; border: 2px solid #4F46E5; border-radius: 8px; font-size: 14px; font-weight: bold; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.15); white-space: nowrap;">${regionInfo.emoji} ${regionInfo.name}</div>`
        customOverlayRef.current.setContent(content)
        customOverlayRef.current.setPosition(mouseEvent.latLng)
        customOverlayRef.current.setMap(map)
      })

      // mousemove 이벤트
      window.kakao.maps.event.addListener(polygon, 'mousemove', function(mouseEvent: any) {
        customOverlayRef.current.setPosition(mouseEvent.latLng)
      })

      // mouseout 이벤트
      window.kakao.maps.event.addListener(polygon, 'mouseout', function() {
        polygon.setOptions({ fillColor: '#fff', fillOpacity: 0.4 })
        customOverlayRef.current.setMap(null)
      })

      // click 이벤트 - 지역 확대 및 시/군/구 경계선 표시
      window.kakao.maps.event.addListener(polygon, 'click', function() {
        // InfoWindow와 CustomOverlay 닫기
        infowindowRef.current.close()
        customOverlayRef.current.setMap(null)
        
        // 클릭된 폴리곤의 스타일을 원래대로 복원
        polygon.setOptions({ fillColor: '#fff', fillOpacity: 0.4 })
        
        // 먼저 모든 시/도 경계선을 표시하고 스타일 초기화 (이전에 숨긴 것 복원)
        polygonsRef.current.forEach(({ polygon: p }) => {
          p.setMap(mapRef.current)
          p.setOptions({ fillColor: '#fff', fillOpacity: 0.4 })
        })
        
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
        
        // 선택된 지역의 시/도 경계선만 숨기기
        polygonsRef.current.forEach(({ polygon: p, regionId: rid }) => {
          if (rid === regionId) {
            p.setMap(null)
          }
        })
      })

      polygonsRef.current.push({ polygon, regionId })
    }

    // GeoJSON 로드 시도
    fetch('/korea-regions.geojson')
      .then(response => response.json())
      .then((geojson: any) => {
        console.log('GeoJSON 로드 성공')
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
        console.log('GeoJSON 폴리곤 생성 완료, 총:', polygonsRef.current.length, '개')
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

  // 행사 마커 표시 함수 (도/광역시 선택 시에만 표시)
  useEffect(() => {
    console.log('[마커 표시] 시작', {
      mapExists: !!mapRef.current,
      kakaoMapsExists: !!window.kakao?.maps,
      selectedRegion: selectedRegion,
      filteredEventsCount: filteredEvents.length,
      filteredEvents: filteredEvents
    })

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (!kakaoMapsLoaded || !mapRef.current || !window.kakao?.maps) {
      console.log('[마커 표시] 지도 또는 카카오맵 API가 준비되지 않음', {
        kakaoMapsLoaded,
        mapExists: !!mapRef.current,
        kakaoMapsExists: !!window.kakao?.maps
      })
      return
    }

    // 도/광역시가 선택되지 않았으면 마커 표시 안 함
    if (!selectedRegion) {
      console.log('[마커 표시] 지역이 선택되지 않아 마커를 표시하지 않음')
      return
    }

    if (!filteredEvents.length) {
      console.log('[마커 표시] 필터링된 행사가 없음')
      return
    }

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
  }, [filteredEvents, handleEventSelect, selectedRegion, kakaoMapsLoaded])

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
        console.log('[상세 지도] 선택된 지역:', regionName, '(ID:', selectedRegion, ')')
        const regionCode = REGION_CODE_MAP[selectedRegion]
        let matchCount = 0
        
        geojson.features.forEach((feature: any) => {
          const sigunguName = feature.properties.name
          const sigunguCode = feature.properties.code || ''
          
          // 코드의 앞 2자리가 지역 코드와 일치하면 해당 지역
          const isMatch = sigunguCode.startsWith(regionCode)
          
          if (isMatch) {
            matchCount++
            console.log('[상세 지도] 매칭된 시/군/구:', sigunguName, '(코드:', sigunguCode, ')')
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

                  // mouseover 이벤트
                  window.kakao.maps.event.addListener(detailPolygon, 'mouseover', function() {
                    detailPolygon.setOptions({ fillColor: '#10b981', fillOpacity: 0.6 })
                  })
                  
                  // mousemove 이벤트 - 지역 이름 표시
                  window.kakao.maps.event.addListener(detailPolygon, 'mousemove', function(mouseEvent: any) {
                    if (sigunguOverlayRef.current) {
                      const content = `<div style="padding: 8px 12px; background: white; border: 1px solid #10b981; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap;">${sigunguName}</div>`
                      sigunguOverlayRef.current.setContent(content)
                      sigunguOverlayRef.current.setPosition(mouseEvent.latLng)
                      sigunguOverlayRef.current.setMap(mapRef.current)
                    }
                  })

                  // mouseout 이벤트
                  window.kakao.maps.event.addListener(detailPolygon, 'mouseout', function() {
                    detailPolygon.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                    // CustomOverlay 숨기기
                    if (sigunguOverlayRef.current) {
                      sigunguOverlayRef.current.setMap(null)
                    }
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

                window.kakao.maps.event.addListener(detailPolygon, 'mouseover', function() {
                  detailPolygon.setOptions({ fillColor: '#10b981', fillOpacity: 0.6 })
                })
                
                // mousemove 이벤트 - 지역 이름 표시
                window.kakao.maps.event.addListener(detailPolygon, 'mousemove', function(mouseEvent: any) {
                  if (sigunguOverlayRef.current) {
                    const content = `<div style="padding: 8px 12px; background: white; border: 1px solid #10b981; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap;">${sigunguName}</div>`
                    sigunguOverlayRef.current.setContent(content)
                    sigunguOverlayRef.current.setPosition(mouseEvent.latLng)
                    sigunguOverlayRef.current.setMap(mapRef.current)
                  }
                })

                window.kakao.maps.event.addListener(detailPolygon, 'mouseout', function() {
                  detailPolygon.setOptions({ fillColor: '#10b981', fillOpacity: 0.05 })
                  // CustomOverlay 숨기기
                  if (sigunguOverlayRef.current) {
                    sigunguOverlayRef.current.setMap(null)
                  }
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
        console.log('[상세 지도] 매칭된 시/군/구:', matchCount, '개')
        console.log('[상세 지도] 생성된 폴리곤:', detailPolygonsRef.current.length, '개')
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
    })
  }, [])

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

            {/* 카카오맵 컨테이너 - 단일 지도 */}
            <div className="relative">
              {/* 뒤로 가기 버튼 (지역 선택 시에만 표시) */}
              {showDetailMap && selectedRegion && (
                <div className="absolute top-4 left-4 z-10">
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
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 transition-colors shadow-lg border border-slate-200"
                    title="뒤로 가기"
                  >
                    <ArrowLeft className="h-5 w-5 text-slate-700" />
                    <span className="text-sm font-medium text-slate-700">
                      {selectedCity ? REGION_INFO[selectedRegion]?.name : '전체 지도'}
                    </span>
                  </button>
                </div>
              )}

              {/* 지역 정보 라벨 (지역 선택 시에만 표시) */}
              {showDetailMap && selectedRegion && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg border border-slate-200">
                    <span className="text-xl">{REGION_INFO[selectedRegion]?.emoji}</span>
                    <span className="text-sm font-bold text-slate-900">
                      {selectedCity || REGION_INFO[selectedRegion]?.name}
                    </span>
            </div>
          </div>
              )}
              
              <div 
                ref={mapContainerRef}
                className="relative overflow-hidden rounded-4xl border border-surface-subtle"
                style={{ width: '100%', height: '600px' }}
              />
              </div>
              
            </div>
        </div>

        <aside className="flex flex-col gap-4 lg:gap-6">
          <div className="rounded-4xl border border-surface-subtle bg-white p-5 shadow-sm md:p-6">
            <div className="grid grid-cols-3 gap-2">
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

