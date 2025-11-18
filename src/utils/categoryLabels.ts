import type { Category } from '../types/events'

// 카테고리 한글 라벨 매핑
export const CATEGORY_LABELS: Record<Category, string> = {
  'team-ball': '구기·팀',
  'racket-ball': '라켓·볼',
  'martial-arts': '무도·격투',
  'fitness-skill': '체력·기술',
  precision: '정밀·기술',
  'ice-snow': '빙상·설원',
  water: '수상·해양',
  leisure: '레저·환경',
  mind: '마인드',
  other: '기타',
}

// 카테고리 라벨 가져오기 (기본값 포함)
export function getCategoryLabel(category: Category): string {
  return CATEGORY_LABELS[category] || category
}

