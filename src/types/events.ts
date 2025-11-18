export type Category =
  | 'football'
  | 'basketball'
  | 'baseball'
  | 'marathon'
  | 'volleyball'
  | 'esports'
  | 'fitness'
  | 'tennis'

export interface Event {
  id: string
  title: string
  summary: string
  region: string
  city: string
  address: string
  category: Category
  date: string
  image: string
  views: number
  pinOffset?: { x: number; y: number }
  organizer?: string // 개최사
  link?: string // 관련 링크
  description?: string // 상세 내용
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
