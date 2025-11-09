import { createContext } from 'react'
import type { EventContextValue } from './types'

export const EventContext = createContext<EventContextValue | undefined>(undefined)
