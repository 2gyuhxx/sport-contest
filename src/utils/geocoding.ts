// 네이버맵 API를 사용한 주소 -> 좌표 변환

const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID || ''
const NAVER_CLIENT_SECRET = import.meta.env.VITE_NAVER_MAP_CLIENT_SECRET || ''

interface NaverGeocodingResponse {
  status: string
  addresses: Array<{
    roadAddress: string
    jibunAddress: string
    x: string // 경도
    y: string // 위도
  }>
  errorMessage?: string
}

interface Coordinates {
  latitude: number
  longitude: number
}

// 주소를 좌표로 변환 (네이버맵 API 사용)
export async function addressToCoordinates(address: string): Promise<Coordinates | null> {
  if (!address || address.trim() === '') {
    return null
  }

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.error('[Geocoding] 네이버 API 키가 설정되지 않았습니다. .env 파일에 VITE_NAVER_MAP_CLIENT_ID와 VITE_NAVER_MAP_CLIENT_SECRET을 설정해주세요.')
    return null
  }

  try {
    const encodedAddress = encodeURIComponent(address)
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodedAddress}`
    
    const response = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
        'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
      },
    })

    if (!response.ok) {
      console.error('[Geocoding] 네이버맵 API 오류:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('[Geocoding] 오류 내용:', errorText)
      return null
    }

    const data: NaverGeocodingResponse = await response.json()

    if (data.status !== 'OK' || !data.addresses || data.addresses.length === 0) {
      console.warn('[Geocoding] 주소를 찾을 수 없습니다:', address)
      return null
    }

    const result = data.addresses[0]

    const coordinates = {
      latitude: parseFloat(result.y),
      longitude: parseFloat(result.x),
    }

    return coordinates
  } catch (error) {
    console.error('[Geocoding] 주소 변환 오류:', error, address)
    return null
  }
}

// 위도/경도를 SVG 좌표로 변환
// 한국 지도 범위: 위도 33~43, 경도 124~132
// SVG viewBox: 0 0 509 716.1
export function coordinatesToSvg(latitude: number, longitude: number): { x: number; y: number } {
  // 한국 지도의 실제 지리 범위
  const MIN_LAT = 33.0
  const MAX_LAT = 43.0
  const MIN_LNG = 124.0
  const MAX_LNG = 132.0

  // SVG viewBox 범위
  const SVG_WIDTH = 509
  const SVG_HEIGHT = 716.1

  // 위도/경도를 0~1 사이 비율로 변환
  const latRatio = (latitude - MIN_LAT) / (MAX_LAT - MIN_LAT)
  const lngRatio = (longitude - MIN_LNG) / (MAX_LNG - MIN_LNG)

  // SVG 좌표로 변환 (위도는 Y축이 반전됨)
  const x = lngRatio * SVG_WIDTH
  const y = (1 - latRatio) * SVG_HEIGHT

  return { x, y }
}

// 주소를 SVG 좌표로 직접 변환
export async function addressToSvgCoordinates(address: string): Promise<{ x: number; y: number } | null> {
  const coords = await addressToCoordinates(address)
  if (!coords) {
    return null
  }

  return coordinatesToSvg(coords.latitude, coords.longitude)
}

// 여러 주소를 한번에 변환 (캐싱 지원)
const coordinatesCache = new Map<string, { x: number; y: number } | null>()

export async function batchAddressToSvgCoordinates(
  addresses: string[]
): Promise<Map<string, { x: number; y: number } | null>> {
  const results = new Map<string, { x: number; y: number } | null>()

  for (const address of addresses) {
    if (coordinatesCache.has(address)) {
      results.set(address, coordinatesCache.get(address)!)
      continue
    }

    const coords = await addressToSvgCoordinates(address)
    coordinatesCache.set(address, coords)
    results.set(address, coords)

    // API 호출 제한을 피하기 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

