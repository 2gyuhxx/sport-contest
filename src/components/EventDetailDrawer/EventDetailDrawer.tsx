import { formatDate } from '../../utils/formatDate'
import type { Event } from '../../types/events'

interface EventDetailDrawerProps {
  event: Event | null
  onClose: () => void
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  if (!event) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-6 md:static md:inset-auto md:px-0 md:pb-0">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-elevate md:relative md:max-w-none md:shadow-none">
        <div className="relative h-48 w-full overflow-hidden rounded-t-2xl md:rounded-xl">
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 md:hidden"
          >
            닫기
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase text-brand-primary">
              {event.category}
            </span>
            <span className="text-xs text-slate-500">{formatDate(event.date)}</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-900">{event.title}</h3>
          <p className="text-sm text-slate-600">{event.summary}</p>
          <div className="rounded-lg bg-surface px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{event.city}</p>
            <p>{event.address}</p>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-surface-subtle px-4 py-2 text-sm text-slate-500 transition hover:border-brand-primary hover:text-brand-primary"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
