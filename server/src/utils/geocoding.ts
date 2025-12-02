import axios from 'axios'

const NAVER_CLIENT_ID = process.env.NAVER_MAP_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_MAP_CLIENT_SECRET

interface NaverGeocodingResult {
  roadAddress: string
  jibunAddress: string
  x: string // 경도
  y: string // 위도
}

interface NaverGeocodingResponse {
  status: string
  addresses: NaverGeocodingResult[]
  errorMessage?: string
}

/**
 * 네이버맵 API를 사용하여 주소를 좌표로 변환
 * @param address 주소 문자열
 * @returns {lat, lng} 또는 null (변환 실패 시)
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.error('[Geocoding] NAVER_MAP_CLIENT_ID 또는 NAVER_MAP_CLIENT_SECRET이 설정되지 않았습니다.')
    return null
  }

  if (!address || address.trim().length === 0) {
    console.warn('[Geocoding] 주소가 비어있습니다.')
    return null
  }

  // 괄호 안의 정보 제거 (예: "(문곡동, 고원체육관)")
  const cleanAddress = address.replace(/\([^)]*\)/g, '').trim()

  try {
    const response = await axios.get<NaverGeocodingResponse>(
      'https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode',
      {
        params: { query: cleanAddress },
        headers: {
          'X-NCP-APIGW-API-KEY-ID': NAVER_CLIENT_ID,
          'X-NCP-APIGW-API-KEY': NAVER_CLIENT_SECRET,
        },
      }
    )

    if (response.data.status === 'OK' && response.data.addresses && response.data.addresses.length > 0) {
      const result = response.data.addresses[0]
      const lat = parseFloat(result.y)
      const lng = parseFloat(result.x)
      return { lat, lng }
    } else {
      return null
    }
  } catch (error: any) {
    return null
  }
}

/**
 * 여러 주소를 배치로 좌표로 변환
 * @param addresses 주소 배열
 * @returns 주소-좌표 매핑 객체
 */
export async function geocodeAddressesBatch(
  addresses: string[]
): Promise<Record<string, { lat: number; lng: number } | null>> {
  const result: Record<string, { lat: number; lng: number } | null> = {}

  for (const address of addresses) {
    const coords = await geocodeAddress(address)
    result[address] = coords

    // API 요청 제한을 피하기 위한 지연
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return result
}

