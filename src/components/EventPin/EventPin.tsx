import type { KeyboardEvent } from 'react'
import type { Event } from '../../types/events'

interface EventPinProps {
  event: Event
  position: { x: number; y: number }
  isActive?: boolean
  onSelect?: (event: Event) => void
}

export function EventPin({
  event,
  position,
  isActive = false,
  onSelect,
}: EventPinProps) {
  const handleSelect = () => {
    onSelect?.(event)
  }

  const handleKeyDown = (eventKey: KeyboardEvent<SVGGElement>) => {
    if (eventKey.key === 'Enter' || eventKey.key === ' ') {
      eventKey.preventDefault()
      onSelect?.(event)
    }
  }

  const radius = isActive ? 9 : 7

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      aria-label={`${event.title} - ${event.city}`}
      className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      <circle r={radius + 6} className="fill-white opacity-80 transition duration-200" />
      <circle
        r={radius}
        className={`fill-brand-accent transition duration-200 transform ${
          isActive ? 'scale-110' : ''
        }`}
      />
    </g>
  )
}
