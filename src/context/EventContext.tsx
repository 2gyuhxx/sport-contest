import { useMemo, useReducer, type ReactNode } from 'react'
import { EventService } from '../services/EventService'
import { EventContext } from './EventContextObject'
import type { EventAction, EventContextValue, EventState } from './types'
import type { EventFilters } from '../types/events'

const initialState: EventState = {
  events: EventService.getAll(),
  regions: EventService.getRegions(),
  categories: EventService.getCategories(),
  selectedRegion: null,
  selectedCategory: null,
  keyword: '',
  activeEventId: null,
}

function eventReducer(state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case 'SELECT_REGION':
      return {
        ...state,
        selectedRegion: action.payload,
        activeEventId: null,
      }
    case 'SELECT_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        activeEventId: null,
      }
    case 'SET_KEYWORD':
      return { ...state, keyword: action.payload }
    case 'CLEAR_FILTERS':
      return { ...state, selectedRegion: null, selectedCategory: null, keyword: '' }
    case 'SET_ACTIVE_EVENT':
      return { ...state, activeEventId: action.payload }
    case 'INCREMENT_VIEW': {
      // 조회수 증가 - EventService에서 localStorage 업데이트 후 상태 갱신
      const newViews = EventService.incrementView(action.payload)
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload ? { ...event, views: newViews } : event,
        ),
      }
    }
    default:
      return state
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(eventReducer, initialState)

  const appliedFilters: EventFilters = useMemo(
    () => ({
      region: state.selectedRegion,
      category: state.selectedCategory,
      keyword: state.keyword,
    }),
    [state.keyword, state.selectedCategory, state.selectedRegion],
  )

  const filteredEvents = useMemo(
    () => EventService.filterEvents(appliedFilters),
    [appliedFilters],
  )

  const value = useMemo<EventContextValue>(
    () => ({
      state,
      filteredEvents,
      dispatch,
      appliedFilters,
    }),
    [state, filteredEvents, appliedFilters, dispatch],
  )

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}
