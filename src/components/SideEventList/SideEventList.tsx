import type { Event } from '../../types/events'
import { EventCard } from '../EventCard'

interface SideEventListProps {
  events: Event[]
  onSelect: (event: Event) => void
  activeEventId?: string | null
  title?: string
}

export function SideEventList({
  events,
  onSelect,
  activeEventId,
  title = '행사 목록',
}: SideEventListProps) {
  return (
    <aside className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm text-slate-500">{events.length}건</span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-surface-subtle bg-white p-6 text-center text-sm text-slate-500">
            조건에 맞는 행사가 없습니다.
          </div>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onSelect={onSelect}
              isActive={activeEventId === event.id}
            />
          ))
        )}
      </div>
    </aside>
  )
}
