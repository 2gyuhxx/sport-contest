import { memo, useState, useCallback, useMemo } from 'react'
import type { Event } from '../../types/events'
import { EventCard } from '../EventCard'
import { EventDetailDrawer } from '../EventDetailDrawer'

interface EventListProps {
  events: Event[]
  onSelect?: (event: Event) => void
  activeEventId?: string | null
  emptyMessage?: string
  layout?: 'grid' | 'stack'
  columns?: 1 | 2 | 3 | 4
  cardVariant?: 'default' | 'compact'
  showDetailOnSelect?: boolean
  detailHrefBase?: string
}

export const EventList = memo(function EventList({
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

  const columnClasses: Record<1 | 2 | 3 | 4, string> = useMemo(
    () => ({
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    }),
    []
  )

  const wrapperClass = useMemo(
    () =>
      layout === 'grid'
        ? `grid gap-5 auto-rows-fr ${columnClasses[columns]}`
        : 'flex flex-col gap-4',
    [layout, columnClasses, columns]
  )

  const handleSelect = useCallback(
    (event: Event) => {
      onSelect?.(event)
      if (showDetailOnSelect) {
        setDetailEvent(event)
      }
    },
    [onSelect, showDetailOnSelect]
  )

  const handleCloseDrawer = useCallback(() => {
    setDetailEvent(null)
  }, [])

  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-surface-subtle bg-white p-6 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div className={wrapperClass}>
        {events.map((event) => (
          <div key={event.id} className={layout === 'grid' ? 'h-full' : ''}>
          <EventCard
            event={event}
            onSelect={handleSelect}
            isActive={activeEventId === event.id || detailEvent?.id === event.id}
            variant={cardVariant}
            layout={layout === 'grid' ? 'vertical' : 'horizontal'}
            detailHref={
              !showDetailOnSelect && detailHrefBase ? `${detailHrefBase}${event.id}` : undefined
            }
        />
          </div>
      ))}
    </div>
      {showDetailOnSelect && (
        <EventDetailDrawer event={detailEvent} onClose={handleCloseDrawer} />
      )}
    </>
  )
})
