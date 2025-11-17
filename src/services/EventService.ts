import { events } from '../data/events'
import { regions } from '../data/regions'
import type { Category, Event, EventFilters, RegionMeta } from '../types/events'
import apiRequest from '../config/api'
import { AuthService } from './AuthService'

const toLower = (value: string) => value.toLowerCase()

const uniqueCategories = Array.from(
  new Set(events.map((event) => event.category)),
) as Category[]

// API 응답 타입
interface SportCategoriesResponse {
  categories: string[]
}

interface RegionsResponse {
  regions: string[]
}

interface SubRegionsResponse {
  subRegions: string[]
}

interface SubSportCategoriesResponse {
  subCategories: string[]
}

interface MyEventResponse {
  events: {
    id: number
    organizer_user_id: number
    organizer_user_name: string | null
    title: string
    description: string
    sport: string
    sub_sport: string | null
    region: string
    sub_region: string
    venue: string | null
    address: string | null
    start_at: string
    end_at: string
    website: string | null
    image: string | null
    status: 'pending' | 'approved' | 'spam'
    created_at: string
    updated_at: string | null
  }[]
}

// 행사 생성 요청 데이터 타입
interface CreateEventData {
  title: string
  description: string
  sport: string
  sub_sport: string
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  start_at: string
  end_at: string
  website: string | null
  image: string | null
  organizer_user_name: string
}

// API 응답 타입
interface CreateEventResponse {
  event: {
    id: number
    organizer_user_id: number
    organizer_user_name: string | null
    title: string
    description: string
    sport: string
    sub_sport: string | null
    region: string
    sub_region: string
    venue: string | null
    address: string | null
    start_at: string
    end_at: string
    website: string | null
    image: string | null
    status: 'pending' | 'approved' | 'spam'
    created_at: string
  }
}

export const EventService = {
  getAll(): Event[] {
    return events
  },
  // 기존 정적 데이터용 메서드들 (하위 호환성 유지)
  getRegionsStatic(): RegionMeta[] {
    return regions
  },
  getRegionById(regionId?: string | null): RegionMeta | undefined {
    if (!regionId) return undefined
    return regions.find((region) => region.id === regionId)
  },
  getCategories(): Category[] {
    return uniqueCategories
  },
  getEventsByRegion(regionId?: string | null): Event[] {
    if (!regionId) return events
    return events.filter((event) => event.region === regionId)
  },
  filterEvents(filters: EventFilters): Event[] {
    const { region, category, keyword } = filters
    const lowerKeyword = keyword ? toLower(keyword) : null

    return events.filter((event) => {
      if (region && event.region !== region) return false
      if (category && event.category !== category) return false
      if (lowerKeyword) {
        const haystack = `${event.title} ${event.summary} ${event.city}`.toLowerCase()
        if (!haystack.includes(lowerKeyword)) return false
      }
      return true
    })
  },

  /**
   * 스포츠 종목 목록 가져오기 (DB에서)
   */
  async getSportCategories(): Promise<string[]> {
    try {
      const response = await apiRequest<SportCategoriesResponse>('/lists/sport-categories')
      return response.categories
    } catch (error) {
      console.error('스포츠 종목 조회 오류:', error)
      throw error
    }
  },

  /**
   * 광역자치단체(지역) 목록 가져오기 (DB에서)
   */
  async getRegions(): Promise<string[]> {
    try {
      const response = await apiRequest<RegionsResponse>('/lists/regions')
      return response.regions
    } catch (error) {
      console.error('지역 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 기초자치단체(시군구) 목록 가져오기 (DB에서)
   * @param regionName 선택한 광역자치단체 이름
   */
  async getSubRegions(regionName: string): Promise<string[]> {
    try {
      const response = await apiRequest<SubRegionsResponse>(
        `/lists/sub-regions?region_name=${encodeURIComponent(regionName)}`
      )
      return response.subRegions
    } catch (error) {
      console.error('시군구 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 스포츠 소분류 목록 가져오기 (DB에서)
   * @param categoryName 선택한 스포츠 대분류 이름
   */
  async getSubSportCategories(categoryName: string): Promise<string[]> {
    try {
      const response = await apiRequest<SubSportCategoriesResponse>(
        `/lists/sub-sport-categories?category_name=${encodeURIComponent(categoryName)}`
      )
      return response.subCategories
    } catch (error) {
      console.error('스포츠 소분류 조회 오류:', error)
      throw error
    }
  },

  /**
   * 내가 등록한 행사 목록 가져오기
   */
  async getMyEvents(): Promise<MyEventResponse['events']> {
    try {
      const response = await apiRequest<MyEventResponse>('/events/my/events')
      return response.events
    } catch (error) {
      console.error('내 행사 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 행사 생성
   */
  async createEvent(data: CreateEventData): Promise<CreateEventResponse['event']> {
    const { title, description, sport, sub_sport, region, sub_region, venue, address, start_at, end_at, website, image, organizer_user_name } = data

    // 입력 검증
    if (!title || !description || !sport || !sub_sport || !region || !sub_region || !start_at || !end_at || !organizer_user_name) {
      throw new Error('모든 필수 필드를 입력해주세요')
    }

    // 날짜 유효성 검사
    if (start_at > end_at) {
      throw new Error('시작 날짜는 종료 날짜보다 이전이어야 합니다')
    }

    // 현재 사용자 정보 가져오기
    const currentUser = AuthService.getCurrentUser()
    if (!currentUser) {
      throw new Error('로그인이 필요합니다')
    }

    try {
      const response = await apiRequest<CreateEventResponse>('/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          sport,
          sub_sport,
          region,
          sub_region,
          venue: venue || null,
          address: address || null,
          start_at,
          end_at,
          website: website || null,
          image: image || null,
          organizer_user_name,
        }),
      })

      return response.event
    } catch (error) {
      throw error
    }
  },

  /**
   * 행사 수정
   */
  async updateEvent(eventId: number, data: CreateEventData): Promise<CreateEventResponse['event']> {
    const { title, description, sport, sub_sport, region, sub_region, venue, address, start_at, end_at, website, image, organizer_user_name } = data

    // 수정 모드에서는 부분 업데이트를 지원하므로 필수 필드 검증 제거
    // 서버에서 기존 값을 사용하도록 처리
    // 단, 날짜 유효성 검사는 수행 (두 날짜가 모두 있을 때만)
    if (start_at && end_at && start_at > end_at) {
      throw new Error('시작 날짜는 종료 날짜보다 이전이어야 합니다')
    }

    // 현재 사용자 정보 가져오기
    const currentUser = AuthService.getCurrentUser()
    if (!currentUser) {
      throw new Error('로그인이 필요합니다')
    }

    try {
      const response = await apiRequest<CreateEventResponse>(`/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          description,
          sport,
          sub_sport,
          region,
          sub_region,
          venue: venue || null,
          address: address || null,
          start_at,
          end_at,
          website: website || null,
          image: image || null,
          organizer_user_name,
        }),
      })

      return response.event
    } catch (error) {
      throw error
    }
  },

  /**
   * 특정 행사 가져오기
   */
  async getEventById(eventId: number): Promise<CreateEventResponse['event']> {
    try {
      const response = await apiRequest<{ event: CreateEventResponse['event'] }>(`/events/${eventId}`)
      return response.event
    } catch (error) {
      console.error('행사 조회 오류:', error)
      throw error
    }
  },

  /**
   * 파일 업로드
   */
  async uploadFile(file: File, eventId?: number): Promise<string> {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('로그인이 필요합니다')
      }

      const formData = new FormData()
      formData.append('file', file)

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
      const uploadUrl = eventId
        ? `${API_BASE_URL}/upload?eventId=${eventId}`
        : `${API_BASE_URL}/upload`

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '파일 업로드에 실패했습니다' }))
        throw new Error(errorData.error || '파일 업로드에 실패했습니다')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      throw error
    }
  },
}
