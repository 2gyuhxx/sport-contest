/**
 * 찜한 이벤트 정보
 */
export interface Favorite {
  id: number
  event_id: number
  user_id: number
  sub_sport: string | null
  created_at: string
}

/**
 * 추천 종목 아이템
 */
export interface RecommendedSportItem {
  sport: string
  score: number
}

