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
  sport?: string // DB의 스포츠 종목 (소분류 이름)
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
