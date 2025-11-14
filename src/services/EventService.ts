import { events } from '../data/events'
import { regions } from '../data/regions'
import type { Category, Event, EventFilters, RegionMeta } from '../types/events'

const toLower = (value: string) => value.toLowerCase()

const uniqueCategories = Array.from(
  new Set(events.map((event) => event.category)),
) as Category[]

// localStorage에서 조회수 데이터 가져오기
const VIEWS_STORAGE_KEY = 'sportable_event_views'

// 조회수 증가 중복 실행 방지를 위한 전역 Set (React Strict Mode 대응)
const viewIncrementLock = new Set<string>()

function getStoredViews(): Record<string, number> {
  const stored = localStorage.getItem(VIEWS_STORAGE_KEY)
  if (!stored) return {}
  try {
    return JSON.parse(stored) as Record<string, number>
  } catch {
    return {}
  }
}

function saveViews(views: Record<string, number>): void {
  localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views))
}

// 초기 조회수를 localStorage에서 불러와서 병합
function mergeViewsWithEvents(baseEvents: Event[]): Event[] {
  const storedViews = getStoredViews()
  return baseEvents.map((event) => ({
    ...event,
    views: storedViews[event.id] ?? event.views,
  }))
}

export const EventService = {
  getAll(): Event[] {
    return mergeViewsWithEvents(events)
  },
  getRegions(): RegionMeta[] {
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
    const eventsWithViews = mergeViewsWithEvents(events)

    return eventsWithViews.filter((event) => {
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
   * 조회수 증가
   * @param eventId 행사 ID
   * @returns 업데이트된 조회수
   */
  incrementView(eventId: string): number {
    // 중복 실행 차단 (React Strict Mode 대응)
    if (viewIncrementLock.has(eventId)) {
      const storedViews = getStoredViews()
      const event = events.find((e) => e.id === eventId)
      return storedViews[eventId] ?? event?.views ?? 0
    }

    // Lock 설정
    viewIncrementLock.add(eventId)
    
    const storedViews = getStoredViews()
    const event = events.find((e) => e.id === eventId)
    
    if (!event) {
      viewIncrementLock.delete(eventId)
      return 0
    }

    // 현재 조회수를 가져오거나 초기값 사용
    const currentViews = storedViews[eventId] ?? event.views
    const newViews = currentViews + 1
    
    // 업데이트된 조회수 저장
    storedViews[eventId] = newViews
    saveViews(storedViews)
    
    // 1초 후 Lock 해제 (다음 페이지 진입 허용)
    setTimeout(() => {
      viewIncrementLock.delete(eventId)
    }, 1000)
    
    return newViews
  },
}
