import axios from 'axios'

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY

interface KakaoGeocodingResult {
  address_name: string
  x: string // 경도
  y: string // 위도
}

interface KakaoGeocodingResponse {
  documents: KakaoGeocodingResult[]
  meta: {
    total_count: number
  }
}

/**
 * 카카오맵 API를 사용하여 주소를 좌표로 변환
 * @param address 주소 문자열
 * @returns {lat, lng} 또는 null (변환 실패 시)
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_API_KEY) {
    console.error('[Geocoding] KAKAO_REST_API_KEY가 설정되지 않았습니다.')
    return null
  }

  if (!address || address.trim().length === 0) {
    console.warn('[Geocoding] 주소가 비어있습니다.')
    return null
  }

  // 괄호 안의 정보 제거 (예: "(문곡동, 고원체육관)")
  const cleanAddress = address.replace(/\([^)]*\)/g, '').trim()

  try {
    const response = await axios.get<KakaoGeocodingResponse>(
      'https://dapi.kakao.com/v2/local/search/address.json',
      {
        params: { query: cleanAddress },
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      }
    )

    if (response.data.documents && response.data.documents.length > 0) {
      const result = response.data.documents[0]
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

