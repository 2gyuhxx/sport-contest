import { useMemo, useReducer, useEffect, useState, useCallback, type ReactNode } from 'react'
import { EventService } from '../services/EventService'
import { EventContext } from './EventContextObject'
import type { EventAction, EventContextValue, EventState } from './types'
import type { EventFilters } from '../types/events'
import { regions } from '../data/regions'

const initialState: EventState = {
  events: [], // DB에서 로드할 때까지 빈 배열
  regions: EventService.getRegionsStatic(), // 정적 데이터 사용
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
    case 'SET_EVENTS':
      return { ...state, events: action.payload }
    case 'ADD_EVENT':
      // 이미 존재하는 행사면 업데이트, 없으면 추가
      const existingIndex = state.events.findIndex((e) => e.id === action.payload.id)
      if (existingIndex >= 0) {
        return {
          ...state,
          events: state.events.map((e, i) => (i === existingIndex ? action.payload : e)),
        }
      }
      return { ...state, events: [...state.events, action.payload] }
    case 'INCREMENT_EVENT_VIEWS':
      // 특정 이벤트의 조회수만 +1 (로컬 상태 업데이트)
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload ? { ...event, views: event.views + 1 } : event
        ),
      }
    case 'UPDATE_EVENT_VIEWS':
      // 서버에서 받은 정확한 조회수로 업데이트
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.eventId ? { ...event, views: action.payload.views } : event
        ),
      }
    case 'UPDATE_EVENT_REPORTS':
      // 신고 정보 업데이트 (reports_count, reports_state)
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.eventId
            ? {
                ...event,
                reports_count: action.payload.reports_count,
                reports_state: action.payload.reports_state as 'normal' | 'pending' | 'blocked',
              }
            : event
        ),
      }
    default:
      return state
  }
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(eventReducer, initialState)
  const [isLoading, setIsLoading] = useState(true)

  // 행사 목록을 DB에서 로드하는 함수
  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true)
      const events = await EventService.getAllEventsFromDB()
      dispatch({ type: 'SET_EVENTS', payload: events })
    } catch (error) {
      console.error('행사 데이터 로드 실패:', error)
      // 오류 발생 시 빈 배열 유지 (이미 initialState에서 빈 배열)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 컴포넌트 마운트 시 DB에서 행사 데이터 로드
  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const appliedFilters: EventFilters = useMemo(
    () => ({
      region: state.selectedRegion,
      category: state.selectedCategory,
      keyword: state.keyword,
    }),
    [state.keyword, state.selectedCategory, state.selectedRegion],
  )

  const filteredEvents = useMemo(() => {
    const { region, category, keyword } = appliedFilters
    const lowerKeyword = keyword ? keyword.toLowerCase() : null

    return state.events.filter((event) => {
      // reports_state가 'normal'이 아닌 이벤트는 다른 사용자에게 보이지 않게 필터링
      // (pending: 신고 5회 이상, blocked: super 계정 판단)
      if (event.reports_state && event.reports_state !== 'normal') return false
      
      if (region && event.region !== region) return false
      if (category && event.category !== category) return false
      if (lowerKeyword) {
        // region 정보 가져오기
        const regionInfo = regions.find(r => r.id === event.region)
        const regionNames = regionInfo 
          ? `${regionInfo.name} ${regionInfo.shortName} ${regionInfo.aliases.join(' ')}`
          : event.region || ''
        
        const haystack = `${event.title} ${event.summary} ${event.city} ${event.region} ${event.sub_region || ''} ${regionNames}`.toLowerCase()
        if (!haystack.includes(lowerKeyword)) return false
      }
      return true
    })
  }, [state.events, appliedFilters])

  const value = useMemo<EventContextValue>(
    () => ({
      state,
      filteredEvents,
      dispatch,
      appliedFilters,
      isLoading,
      refreshEvents: loadEvents,
    }),
    [state, filteredEvents, appliedFilters, isLoading, loadEvents],
  )

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}
