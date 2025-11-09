import { useState } from 'react'
import type { Event } from '../../types/events'
import { EventCard } from '../EventCard'
import { EventDetailDrawer } from '../EventDetailDrawer'

interface EventListProps {
  events: Event[]
  onSelect?: (event: Event) => void
  activeEventId?: string | null
  emptyMessage?: string
  layout?: 'grid' | 'stack'
  columns?: 2 | 3 | 4
  cardVariant?: 'default' | 'compact'
  showDetailOnSelect?: boolean
  detailHrefBase?: string
}

export function EventList({
  events,
  onSelect,
  activeEventId,
  emptyMessage = '등록된 행사가 없습니다.',
  layout = 'grid',
  columns = 2,
  cardVariant = 'default',
  showDetailOnSelect = false,
  detailHrefBase,
}: EventListProps) {
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)

  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-surface-subtle bg-white p-6 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }

  const columnClasses: Record<2 | 3 | 4, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  const wrapperClass =
    layout === 'grid'
      ? `grid gap-5 ${columnClasses[columns]}`
      : 'flex flex-col gap-4'

  const handleSelect = (event: Event) => {
    onSelect?.(event)
    if (showDetailOnSelect) {
      setDetailEvent(event)
    }
  }

  return (
    <>
      <div className={wrapperClass}>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onSelect={handleSelect}
            isActive={activeEventId === event.id || detailEvent?.id === event.id}
            variant={cardVariant}
            layout={layout === 'grid' ? 'vertical' : 'horizontal'}
            detailHref={
              !showDetailOnSelect && detailHrefBase ? `${detailHrefBase}${event.id}` : undefined
            }
        />
      ))}
    </div>
      {showDetailOnSelect && (
        <EventDetailDrawer event={detailEvent} onClose={() => setDetailEvent(null)} />
      )}
    </>
  )
}
