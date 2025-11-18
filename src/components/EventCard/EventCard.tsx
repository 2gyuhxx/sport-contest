import { Link } from 'react-router-dom'
import type { Event } from '../../types/events'
import { formatDate } from '../../utils/formatDate'
import { classNames } from '../../utils/classNames'
import { getCategoryLabel } from '../../utils/categoryLabels'
import { CheckCircle2, XCircle } from 'lucide-react'

interface EventCardProps {
  event: Event
  onSelect?: (event: Event) => void
  isActive?: boolean
  layout?: 'horizontal' | 'vertical'
  variant?: 'default' | 'compact'
  detailHref?: string
}

export function EventCard({
  event,
  onSelect,
  isActive = false,
  layout = 'horizontal',
  variant = 'default',
  detailHref,
}: EventCardProps) {
  const handleClick = () => {
    onSelect?.(event)
  }

  const isCompact = variant === 'compact'
  const effectiveLayout = isCompact ? 'vertical' : layout
  const containerClasses = classNames(
    'group relative overflow-hidden border bg-white transition duration-200',
    isCompact
      ? 'rounded-xl shadow-sm hover:shadow-lg'
      : 'rounded-2xl shadow-sm hover:shadow-elevate',
    'hover:border-brand-primary',
    isActive ? 'ring-2 ring-brand-primary' : '',
    effectiveLayout === 'horizontal' ? 'flex flex-col md:flex-row' : 'flex flex-col',
  )

  const imageClasses = classNames(
    'relative overflow-hidden',
    isCompact
      ? 'h-32 w-full'
      : effectiveLayout === 'horizontal'
        ? 'h-48 w-full md:h-auto md:basis-1/2'
        : 'h-44 w-full',
  )

  const bodyPadding = isCompact ? 'p-4' : 'p-5'

  const card = (
    <article
      onClick={handleClick}
      className={containerClasses}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={isActive || undefined}
    >
      <div className={imageClasses}>
        <img
          src={event.image}
          alt={event.title}
          className={classNames(
            'h-full w-full object-cover transition duration-200',
            isCompact ? 'group-hover:scale-105' : 'group-hover:scale-105',
          )}
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold tracking-wide text-brand-secondary">
          {event.sport || getCategoryLabel(event.category)}
        </span>
        {/* 진행/종료 상태 배지 */}
        {event.event_status && (
          <div className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            event.event_status === 'active'
              ? 'bg-green-100 text-green-800 border-green-300'
              : 'bg-gray-100 text-gray-800 border-gray-300'
          }`}>
            {event.event_status === 'active' ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>진행</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                <span>종료</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className={classNames('flex flex-1 flex-col gap-2', bodyPadding)}>
        <header className="flex flex-col gap-2">
          <h3
            className={classNames(
              'font-semibold text-slate-900',
              isCompact ? 'text-base leading-snug' : 'text-lg md:text-xl',
            )}
          >
            {event.title}
          </h3>
          <p className={classNames('text-slate-500', isCompact ? 'text-xs' : 'text-sm')}>
            {event.city} · {formatDate(event.date)}
          </p>
        </header>
        <p
          className={classNames(
            'text-slate-600',
            isCompact ? 'text-xs leading-snug line-clamp-2' : 'text-sm leading-relaxed',
          )}
        >
          {event.summary}
        </p>
        <footer className="mt-auto flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">📍</span>
            {isCompact ? event.region.toUpperCase() : (event.venue || event.address)}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span aria-hidden="true">👁</span>
            {event.views.toLocaleString()}
          </span>
        </footer>
      </div>
    </article>
  )

  if (detailHref) {
    return (
      <Link to={detailHref} className="block">
        {card}
      </Link>
    )
  }

  return card
}
