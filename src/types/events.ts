// 스포츠 카테고리 타입 (DB의 대분류 카테고리)
export type Category =
  | 'team-ball'
  | 'racket-ball'
  | 'martial-arts'
  | 'fitness-skill'
  | 'precision'
  | 'ice-snow'
  | 'water'
  | 'leisure'
  | 'mind'
  | 'other'

export interface Event {
  id: string
  title: string
  summary: string
  region: string
  city: string
  sub_region?: string | null // 시/군/구 (DB의 sub_region 필드)
  venue?: string // 장소명
  address: string
  category: Category
  date: string
  image: string
  views: number
  pinOffset?: { x: number; y: number }
  organizer?: string // 개최사
  link?: string // 관련 링크
  description?: string // 상세 내용
  sport?: string // DB의 스포츠 종목 (소분류 우선, 없으면 대분류)
  sub_sport?: string | null // DB의 소분류 이름
  event_status?: 'active' | 'inactive' // 행사 상태 (eraser 필드에서 변환)
  reports_count?: number // 신고 횟수
  reports_state?: 'normal' | 'pending' | 'blocked' // 신고 상태 (기본값: normal)
  start_at?: string // 행사 시작일
  end_at?: string // 행사 종료일
  registration_deadline?: string // 신청 마감일
  lat?: number // 위도
  lng?: number // 경도
}

export interface EventReport {
  id?: number
  user_id: number
  events_id: number
  report_reason: string
  created_at?: string
}

export interface RegionMeta {
  id: string
  name: string
  slug: string
  shortName: string
  svgId: string
  prefix: string
  aliases: string[]
  view: {
    center: [number, number]
    zoom: number
  }
  cities: string[]
}

export interface EventFilters {
  region?: string | null
  category?: Category | null
  keyword?: string
}
