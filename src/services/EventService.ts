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

// 대분류 스포츠 카테고리 타입
export interface SportCategory {
  id: number
  name: string
  description: string | null
  created_at: string
}

// 소분류 스포츠 카테고리 타입
export interface SubSportCategory {
  id: number
  category_name: string
  name: string
}

interface SportCategoriesResponseAPI {
  categories: SportCategory[]
}

interface SubSportCategoriesResponse {
  subCategories: SubSportCategory[]
}

// DB에서 가져온 행사 데이터 타입
interface DBEvent {
  id: number
  organizer_user_id: number
  organizer_user_name: string | null
  title: string
  description: string
  sport: string
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  start_at: string
  end_at: string
  website: string | null
  views: number
  status: 'pending' | 'approved' | 'spam'
  created_at: string
  updated_at: string | null
}

interface AllEventsResponse {
  events: DBEvent[]
}

interface MyEventResponse {
  events: DBEvent[]
}

// DB 행사 데이터를 프론트엔드 Event 타입으로 변환
function transformDBEventToEvent(dbEvent: DBEvent): Event {
  // sport를 Category로 매핑 (대소문자 구분 없이)
  const sportLower = dbEvent.sport.toLowerCase()
  let category: Category = 'fitness' // 기본값
  
  const categoryMap: Record<string, Category> = {
    '축구': 'football',
    'football': 'football',
    '농구': 'basketball',
    'basketball': 'basketball',
    '야구': 'baseball',
    'baseball': 'baseball',
    '마라톤': 'marathon',
    'marathon': 'marathon',
    '달리기': 'marathon',
    'running': 'marathon',
    '배구': 'volleyball',
    'volleyball': 'volleyball',
    'e스포츠': 'esports',
    'esports': 'esports',
    '피트니스': 'fitness',
    'fitness': 'fitness',
    '요가': 'fitness',
    'yoga': 'fitness',
  }
  
  category = categoryMap[sportLower] || categoryMap[dbEvent.sport] || 'fitness'
  
  // DB의 region 문자열을 프론트엔드 region id로 매핑
  let regionId = dbEvent.region.toLowerCase() // 기본값: 소문자로 변환
  
  // regions.ts의 aliases를 사용하여 매핑
  const regionMeta = regions.find((r) => 
    r.name === dbEvent.region || 
    r.shortName === dbEvent.region ||
    r.aliases.includes(dbEvent.region) ||
    r.id === dbEvent.region.toLowerCase()
  )
  
  if (regionMeta) {
    regionId = regionMeta.id
  }
  
  // 기본 이미지 (카테고리별)
  const defaultImages: Record<Category, string> = {
    football: 'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=900&q=60',
    basketball: 'https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=900&q=60',
    baseball: 'https://images.unsplash.com/photo-1508766206392-8bd5cf550d1c?auto=format&fit=crop&w=900&q=60',
    marathon: 'https://images.unsplash.com/photo-1502818364360-24d9bff88ec5?auto=format&fit=crop&w=900&q=60',
    volleyball: 'https://images.unsplash.com/photo-1508881594126-2a3e7a67db47?auto=format&fit=crop&w=900&q=60',
    esports: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=60',
    fitness: 'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?auto=format&fit=crop&w=900&q=60',
  }

  return {
    id: dbEvent.id.toString(),
    title: dbEvent.title,
    summary: dbEvent.description,
    region: regionId,
    city: dbEvent.sub_region,
    address: dbEvent.address || dbEvent.venue || '',
    category,
    date: dbEvent.start_at.split('T')[0], // YYYY-MM-DD 형식으로 변환
    image: defaultImages[category],
    views: dbEvent.views || 0, // DB의 views 값 사용
    organizer: dbEvent.organizer_user_name || undefined,
    link: dbEvent.website || undefined,
    description: dbEvent.description,
    sport: dbEvent.sport, // DB의 스포츠 종목 (소분류 이름)
  }
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
  /**
   * DB에서 모든 행사 가져오기 (승인된 행사만)
   */
  async getAllEventsFromDB(): Promise<Event[]> {
    try {
      const response = await apiRequest<AllEventsResponse>('/events')
      // status가 'approved'인 행사만 필터링하여 반환
      const approvedEvents = response.events.filter(event => event.status === 'approved')
      return approvedEvents.map(transformDBEventToEvent)
    } catch (error) {
      console.error('행사 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * Mock 데이터 가져오기 (하위 호환성 유지)
   */
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
  async getMyEvents(): Promise<DBEvent[]> {
    try {
      const response = await apiRequest<MyEventResponse>('/events/my/events')
      return response.events
    } catch (error) {
      console.error('내 행사 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 내가 등록한 행사 목록 가져오기 (프론트엔드 타입으로 변환)
   */
  async getMyEventsTransformed(): Promise<Event[]> {
    try {
      const dbEvents = await this.getMyEvents()
      return dbEvents.map(transformDBEventToEvent)
    } catch (error) {
      console.error('내 행사 목록 조회 오류:', error)
      throw error
    }
  },

  /**
   * 행사 조회수 증가
   */
  async incrementEventViews(eventId: string | number): Promise<void> {
    try {
      await apiRequest(`/events/${eventId}/view`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('조회수 증가 오류:', error)
      // 조회수 증가 실패해도 에러는 던지지 않음
    }
  },

  /**
   * 대분류 스포츠 카테고리 목록 가져오기 (DB에서 대분류 테이블)
   */
  async getSportCategoriesDB(): Promise<SportCategory[]> {
    try {
      const response = await apiRequest<SportCategoriesResponseAPI>('/sport-categories', {
        method: 'GET',
      })
      return response.categories
    } catch (error) {
      console.error('대분류 카테고리 조회 오류:', error)
      throw new Error('대분류 카테고리를 불러오는데 실패했습니다')
    }
  },

  /**
   * 특정 대분류의 소분류 스포츠 카테고리 목록 가져오기
   */
  async getSubSportCategories(categoryId: number): Promise<SubSportCategory[]> {
    try {
      const response = await apiRequest<SubSportCategoriesResponse>(
        `/sport-categories/${categoryId}/sub-categories`,
        {
          method: 'GET',
        }
      )
      return response.subCategories
    } catch (error) {
      console.error('소분류 카테고리 조회 오류:', error)
      throw new Error('소분류 카테고리를 불러오는데 실패했습니다')
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
