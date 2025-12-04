import type { Event } from '../types/events'
import { regions } from '../data/regions'

/**
 * 이벤트의 검색 가능한 텍스트를 생성합니다.
 * 제목, 도시, 요약, 종목명, 지역 정보 등을 포함합니다.
 */
export function createEventSearchText(event: Event): string {
  const regionInfo = regions.find(r => r.id === event.region)
  const regionNames = regionInfo
    ? `${regionInfo.name} ${regionInfo.shortName} ${regionInfo.aliases.join(' ')}`
    : event.region || ''

  return `${event.title} ${event.city} ${event.summary || ''} ${event.sport || ''} ${event.sub_sport || ''} ${event.region} ${event.sub_region || ''} ${regionNames}`.toLowerCase()
}

/**
 * 이벤트 목록을 검색어로 필터링합니다.
 */
export function filterEventsBySearch(events: Event[], searchQuery: string): Event[] {
  if (!searchQuery.trim()) {
    return events
  }

  const lowerCaseQuery = searchQuery.toLowerCase()

  return events.filter(event => {
    const searchText = createEventSearchText(event)
    return searchText.includes(lowerCaseQuery)
  })
}

/**
 * 이벤트를 마감일 순으로 정렬합니다.
 * registration_deadline > end_at > date 순으로 우선순위를 가집니다.
 */
export function sortEventsByDeadline(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const deadlineA = a.registration_deadline || a.end_at || a.date
    const deadlineB = b.registration_deadline || b.end_at || b.date
    const dateA = new Date(deadlineA).getTime()
    const dateB = new Date(deadlineB).getTime()
    return dateA - dateB
  })
}

/**
 * 이벤트를 조회수 순으로 정렬합니다.
 */
export function sortEventsByViews(events: Event[]): Event[] {
  return [...events].sort((a, b) => b.views - a.views)
}

