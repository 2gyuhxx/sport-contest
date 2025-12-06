import { regions } from '../data/regions'
import type { Category, Event, RegionMeta, EventReport } from '../types/events'
import apiRequest, { API_BASE_URL } from '../config/api'
import { AuthService } from './AuthService'

// 모든 카테고리 목록 (타입에서 직접 정의)
const ALL_CATEGORIES: Category[] = [
  'team-ball',
  'racket-ball',
  'martial-arts',
  'fitness-skill',
  'precision',
  'ice-snow',
  'water',
  'leisure',
  'mind',
  'other',
]

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
  sport: string // 대분류 이름
  sub_sport: string | null // 소분류 이름
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  lat: number | null
  lng: number | null
  start_at: string
  end_at: string
  website: string | null
  views: number
  image: string | null // 오브젝트 스토리지 이미지 URL
  status: 'pending' | 'approved' | 'spam'
  eraser: 'active' | 'inactive' | null
  reports_count?: number // 신고 횟수
  reports_state?: 'normal' | 'pending' | 'blocked' // 신고 상태 (기본값: normal)
  created_at: string
  updated_at: string | null
}

interface AllEventsResponse {
  events: DBEvent[]
}

interface MyEventResponse {
  events: DBEvent[]
}

// 한글 스포츠 이름을 카테고리 ID로 변환하는 맵 (공통 사용)
export const categoryMap: Record<string, Category> = {
    // 구기·팀
    '구기·팀': 'team-ball',
    '축구': 'team-ball',
    '농구': 'team-ball',
    '야구': 'team-ball',
    '배구': 'team-ball',
    
    // 라켓·볼
    '라켓·볼': 'racket-ball',
    '테니스': 'racket-ball',
    '배드민턴': 'racket-ball',
    '탁구': 'racket-ball',
    
    // 무도·격투
    '무도·격투': 'martial-arts',
    '태권도': 'martial-arts',
    '유도': 'martial-arts',
    '검도': 'martial-arts',
    
    // 체력·기술
    '체력·기술': 'fitness-skill',
    '피트니스': 'fitness-skill',
    '요가': 'fitness-skill',
    '크로스핏': 'fitness-skill',
    '헬스': 'fitness-skill',
    
    // 정밀·기술
    '정밀·기술': 'precision',
    '사격': 'precision',
    '양궁': 'precision',
    
    // 빙상·설원
    '빙상·설원': 'ice-snow',
    '스키': 'ice-snow',
    '스케이트': 'ice-snow',
    
    // 수상·해양
    '수상·해양': 'water',
    '수영': 'water',
    '서핑': 'water',
    '다이빙': 'water',
    
    // 레저·환경
    '레저·환경': 'leisure',
    '등산': 'leisure',
    '사이클': 'leisure',
    '골프': 'leisure',
    '마라톤': 'leisure',
    '달리기': 'leisure',
    
    // 마인드
    '마인드': 'mind',
    '명상': 'mind',
    
    // 기타
    '기타': 'other',
    'e스포츠': 'other',
}

// 카테고리 ID를 한글 대분류 이름으로 변환하는 역맵 (DB 저장용)
export const categoryToKoreanMap: Record<Category, string> = {
    'team-ball': '구기·팀',
    'racket-ball': '라켓·볼',
    'martial-arts': '무도·격투',
    'fitness-skill': '체력·기술',
    'precision': '정밀·기술',
    'ice-snow': '빙상·설원',
    'water': '수상·해양',
    'leisure': '레저·환경',
    'mind': '마인드',
    'other': '기타',
}

// DB 행사 데이터를 프론트엔드 Event 타입으로 변환
export function transformDBEventToEvent(dbEvent: DBEvent): Event {
  // sport를 Category로 매핑 (SearchPage의 SPORT_CATEGORIES와 일치)
  let category: Category = 'other' // 기본값
  
  category = categoryMap[dbEvent.sport] || categoryMap[dbEvent.sport.toLowerCase()] || 'other'
  
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
  
  return {
    id: dbEvent.id.toString(),
    title: dbEvent.title,
    summary: dbEvent.description,
    region: regionId,
    city: dbEvent.sub_region,
    sub_region: dbEvent.sub_region || null, // 시/군/구 (별도 필드로 저장)
    venue: dbEvent.venue || undefined, // 장소명
    address: dbEvent.address || dbEvent.venue || '', // 주소 (없으면 장소명)
    category,
    date: dbEvent.start_at.split('T')[0], // YYYY-MM-DD 형식으로 변환
    image: (dbEvent.image && dbEvent.image.trim() !== '') ? dbEvent.image : '', // DB 이미지가 있으면 사용, 없으면 빈 문자열
    views: dbEvent.views || 0, // DB의 views 값 사용
    organizer: dbEvent.organizer_user_name || undefined,
    link: dbEvent.website || undefined,
    description: dbEvent.description,
    sport: dbEvent.sub_sport || dbEvent.sport, // 소분류가 있으면 소분류, 없으면 대분류 사용
    sub_sport: dbEvent.sub_sport || null, // 소분류 이름 (별도 필드로 저장)
    event_status: (dbEvent.eraser === 'active' || dbEvent.eraser === 'inactive') ? dbEvent.eraser : undefined, // eraser를 event_status로 변환
    reports_count: dbEvent.reports_count || 0, // 신고 횟수
    reports_state: dbEvent.reports_state || 'normal', // 신고 상태 (기본값: normal)
    start_at: dbEvent.start_at, // 행사 시작일
    end_at: dbEvent.end_at, // 행사 종료일
    lat: dbEvent.lat ? Number(dbEvent.lat) : undefined, // 위도
    lng: dbEvent.lng ? Number(dbEvent.lng) : undefined, // 경도
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

  // 기존 정적 데이터용 메서드들
  getRegionsStatic(): RegionMeta[] {
    return regions
  },
  getCategories(): Category[] {
    return ALL_CATEGORIES
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
   * 스포츠 소분류 목록 가져오기 (DB에서) - 이름으로 조회
   * @param categoryName 선택한 스포츠 대분류 이름
   */
  async getSubSportCategoriesByName(categoryName: string): Promise<SubSportCategory[]> {
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
  async incrementEventViews(eventId: string | number): Promise<{ views: number } | null> {
    try {
      const response = await apiRequest<{ success: boolean; message: string; views: number }>(`/events/${eventId}/view`, {
        method: 'POST',
      })
      return { views: response.views }
    } catch (error) {
      console.error('조회수 증가 오류:', error)
      // 조회수 증가 실패해도 에러는 던지지 않음
      return null
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
   * 특정 대분류의 소분류 스포츠 카테고리 목록 가져오기 - ID로 조회
   * @param categoryId 스포츠 대분류 ID
   */
  async getSubSportCategoriesById(categoryId: number): Promise<SubSportCategory[]> {
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
   * 행사 이미지만 업데이트 (pending 상태 체크 없음 - 행사 생성 직후 이미지 업로드용)
   */
  async updateEventImage(eventId: number, imageUrl: string): Promise<void> {
    try {
      await apiRequest<{ success: boolean }>(`/events/${eventId}/image`, {
        method: 'PATCH',
        body: JSON.stringify({ image: imageUrl }),
      })
    } catch (error) {
      console.error('행사 이미지 업데이트 오류:', error)
      throw error
    }
  },

  /**
   * 특정 행사 가져오기
   */
  async getEventById(eventId: number): Promise<DBEvent> {
    try {
      const response = await apiRequest<{ event: DBEvent }>(`/events/${eventId}`)
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
        
        // 토큰 만료 시 로그아웃 처리
        if (response.status === 401 || errorData.error === '유효하지 않은 토큰입니다') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
        }
        
        throw new Error(errorData.error || '파일 업로드에 실패했습니다')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      throw error
    }
  },

  /**
   * 행사 삭제
   */
  async deleteEvent(eventId: number): Promise<void> {
    try {
      await apiRequest<{ success: boolean; message: string }>(
        `/events/${eventId}`,
        {
          method: 'DELETE',
        }
      )
    } catch (error) {
      console.error('행사 삭제 오류:', error)
      throw error
    }
  },

  /**
   * 행사 신고
   */
  async reportEvent(eventId: number, reason: string): Promise<{ report: EventReport; event: { reports_count: number; reports_state: string } }> {
    try {
      const response = await apiRequest<{ 
        report: EventReport
        event: { reports_count: number; reports_state: string }
      }>(`/events/${eventId}/report`, {
        method: 'POST',
        body: JSON.stringify({ report_reason: reason }),
      })
      return response
    } catch (error) {
      console.error('행사 신고 오류:', error)
      throw error
    }
  },

  /**
   * 행사 신고 취소
   */
  async cancelReport(eventId: number): Promise<{ event: { reports_count: number; reports_state: string } }> {
    try {
      const response = await apiRequest<{ 
        event: { reports_count: number; reports_state: string }
      }>(`/events/${eventId}/report`, {
        method: 'DELETE',
      })
      return response
    } catch (error) {
      console.error('행사 신고 취소 오류:', error)
      throw error
    }
  },

  /**
   * 사용자가 해당 행사를 신고했는지 확인
   */
  async checkUserReport(eventId: number): Promise<EventReport | null> {
    try {
      const response = await apiRequest<{ report: EventReport | null }>(`/events/${eventId}/report/check`)
      return response.report
    } catch (error) {
      console.error('신고 확인 오류:', error)
      return null
    }
  },

  /**
   * 관리자: pending 상태인 행사 목록 조회
   */
  async getPendingEvents(): Promise<Array<DBEvent & { reports: Array<EventReport & { user_name?: string; user_email?: string }> }>> {
    try {
      const response = await apiRequest<{ 
        events: Array<DBEvent & { reports: Array<EventReport & { user_name?: string; user_email?: string }> }> 
      }>('/events/admin/pending')
      return response.events
    } catch (error) {
      console.error('pending 행사 조회 오류:', error)
      throw error
    }
  },

  /**
   * 관리자: 행사의 reports_state 변경
   */
  async updateEventReportState(eventId: number, reports_state: 'normal' | 'pending' | 'blocked'): Promise<DBEvent> {
    try {
      const response = await apiRequest<{ 
        message: string
        event: DBEvent 
      }>(`/events/admin/${eventId}/report-state`, {
        method: 'PATCH',
        body: JSON.stringify({ reports_state }),
      })
      return response.event
    } catch (error) {
      console.error('행사 상태 변경 오류:', error)
      throw error
    }
  },
}
