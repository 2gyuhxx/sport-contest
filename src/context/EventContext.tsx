import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { EventService } from '../services/EventService'
import { EventContext } from './EventContextObject'
import type { EventAction, EventContextValue, EventState } from './types'
import type { EventFilters } from '../types/events'

const initialState: EventState = {
  events: [], // 초기값은 빈 배열, DB에서 로드
  regions: EventService.getRegionsStatic(), // 정적 데이터 사용
  categories: EventService.getCategories(),
  selectedRegion: null,
  selectedCategory: null,
  keyword: '',
  activeEventId: null,
  isLoading: true, // 초기 로딩 상태
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
    case 'SET_EVENTS':
      return { ...state, events: action.payload, isLoading: false }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    default:
      return state
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(eventReducer, initialState)

  // 컴포넌트 마운트 시 DB에서 행사 데이터 로드
  useEffect(() => {
    const loadEvents = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true })
        const dbEvents = await EventService.getAllEventsFromDB()
        console.log('[EventContext] 로드된 행사 수:', dbEvents.length)
        dispatch({ type: 'SET_EVENTS', payload: dbEvents })
      } catch (error) {
        console.error('행사 데이터 로드 오류:', error)
        // 오류 발생 시 빈 배열 유지하고 로딩 상태 해제
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_EVENTS', payload: [] })
      }
    }

    loadEvents()
  }, [])

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
