import { useContext } from 'react'
import { EventContext } from './EventContextObject'

export function useEventContext() {
  const context = useContext(EventContext)
  if (!context) {
    throw new Error('useEventContext must be used within EventProvider')
  }
  return context
}
