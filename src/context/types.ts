import type { Category, Event, EventFilters, RegionMeta } from '../types/events'

export interface EventState {
  events: Event[]
  regions: RegionMeta[]
  categories: Category[]
  selectedRegion: string | null
  selectedCategory: Category | null
  keyword: string
  activeEventId: string | null
  isLoading: boolean
}

export type EventAction =
  | { type: 'SELECT_REGION'; payload: string | null }
  | { type: 'SELECT_CATEGORY'; payload: Category | null }
  | { type: 'SET_KEYWORD'; payload: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_ACTIVE_EVENT'; payload: string | null }
  | { type: 'SET_EVENTS'; payload: Event[] }
  | { type: 'INCREMENT_EVENT_VIEWS'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }

export interface EventContextValue {
  state: EventState
  filteredEvents: Event[]
  dispatch: (action: EventAction) => void
  appliedFilters: EventFilters
  isLoading: boolean
  refreshEvents: () => Promise<void>
}
