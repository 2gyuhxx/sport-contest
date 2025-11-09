import { events } from '../data/events'
import { regions } from '../data/regions'
import type { Category, Event, EventFilters, RegionMeta } from '../types/events'

const toLower = (value: string) => value.toLowerCase()

const uniqueCategories = Array.from(
  new Set(events.map((event) => event.category)),
) as Category[]

export const EventService = {
  getAll(): Event[] {
    return events
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
}
