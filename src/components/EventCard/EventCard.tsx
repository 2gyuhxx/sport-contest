import { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Event } from '../../types/events'
import { formatDate } from '../../utils/formatDate'
import { classNames } from '../../utils/classNames'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { categoryToKoreanMap } from '../../services/EventService'
import { getDefaultImage } from '../../utils/defaultImages'

// D-day 계산 함수
function calculateDday(targetDate: string): { text: string; isPast: boolean; daysLeft: number } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { text: '마감', isPast: true, daysLeft: diffDays }
  } else if (diffDays === 0) {
    return { text: 'D-day', isPast: false, daysLeft: 0 }
  } else {
    return { text: `D-${diffDays}`, isPast: false, daysLeft: diffDays }
  }
}

interface EventCardProps {
  event: Event
  onSelect?: (event: Event) => void
  isActive?: boolean
  layout?: 'horizontal' | 'vertical'
  variant?: 'default' | 'compact'
  detailHref?: string
}

export const EventCard = memo(function EventCard({
  event,
  onSelect,
  isActive = false,
  layout = 'horizontal',
  variant = 'default',
  detailHref,
}: EventCardProps) {
  const handleClick = useCallback(() => {
    onSelect?.(event)
  }, [event, onSelect])

  const isCompact = variant === 'compact'
  
  // 마감일 계산 (신청 마감일 우선, 없으면 행사 종료일)
  const deadlineDate = event.registration_deadline || event.end_at
  const ddayInfo = deadlineDate ? calculateDday(deadlineDate) : null
  const effectiveLayout = isCompact ? 'horizontal' : layout
  const containerClasses = classNames(
    'group relative overflow-hidden transition duration-200',
    isCompact
      ? 'rounded-xl border-2 border-slate-200 bg-white hover:border-brand-primary hover:shadow-md flex flex-row'
      : 'rounded-2xl border bg-white shadow-sm hover:shadow-elevate',
    !isCompact && 'hover:border-brand-primary',
    isActive ? 'ring-2 ring-brand-primary' : '',
    !isCompact && (effectiveLayout === 'horizontal' ? 'flex flex-col md:flex-row' : 'flex flex-col h-full'),
  )

  const imageClasses = classNames(
    'relative overflow-hidden',
    isCompact
      ? 'w-48 h-auto flex-shrink-0 rounded-l-xl'
      : effectiveLayout === 'horizontal'
        ? 'h-48 w-full md:h-auto md:basis-1/2 flex-shrink-0'
        : 'h-44 w-full',
  )

  const bodyPadding = isCompact ? 'p-5' : 'p-5'

  const card = (
    <article
      onClick={handleClick}
      className={containerClasses}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={isActive || undefined}
    >
      <div className={classNames(imageClasses, isCompact && 'bg-slate-50')}>
        <img
          src={(event.image && event.image.trim() !== '') 
            ? event.image 
            : getDefaultImage(event.sub_sport, event.sport, event.category)}
          alt={event.title}
          className={classNames(
            'h-full w-full transition duration-200',
            isCompact ? 'object-contain' : 'object-cover group-hover:scale-105',
          )}
          loading="lazy"
          decoding="async"
        />
        <span className={classNames(
          'absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-brand-secondary shadow-sm',
          isCompact ? 'bg-white/95' : 'bg-white/90'
        )}>
          {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category || ''}
        </span>
        {/* 진행/종료 상태 배지 */}
        {event.event_status && (
          <div className={classNames(
            'absolute right-3 top-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm',
            event.event_status === 'active'
              ? 'bg-green-100/95 text-green-800 border-green-300'
              : 'bg-gray-100/95 text-gray-800 border-gray-300'
          )}>
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
      <div className={classNames('flex flex-col', bodyPadding, isCompact ? 'gap-3 flex-1' : 'gap-2 flex-1')}>
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={classNames(
                'font-bold text-slate-900 flex-1',
                isCompact ? 'text-base sm:text-lg leading-snug line-clamp-3' : 'text-lg md:text-xl min-h-[3.5rem] line-clamp-2',
              )}
            >
              {event.title}
            </h3>
            {/* D-day 배지 */}
            {ddayInfo && (
              <span
                className={classNames(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold whitespace-nowrap flex-shrink-0',
                  isCompact ? 'text-sm' : 'text-xs',
                  ddayInfo.isPast
                    ? 'bg-gray-100 text-gray-600'
                    : ddayInfo.daysLeft === 0
                      ? 'bg-red-500 text-white shadow-md'
                      : ddayInfo.daysLeft <= 3
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-blue-500 text-white shadow-md'
                )}
              >
                <Clock className={classNames(isCompact ? 'h-4 w-4' : 'h-3 w-3')} />
                {ddayInfo.text}
              </span>
            )}
          </div>
          <div className={classNames('text-slate-600', isCompact ? 'text-sm' : 'text-sm')}>
            <p className="font-medium">
              📅 {event.city} · {event.start_at ? formatDate(event.start_at) : formatDate(event.date)}
              {event.end_at && event.start_at !== event.end_at && (
                <> ~ {formatDate(event.end_at)}</>
              )}
            </p>
          </div>
        </header>
        <footer className="mt-auto flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 truncate text-slate-700 font-medium">
            <span aria-hidden="true">📍</span>
            <span className="truncate">{isCompact ? (event.venue || event.address) : (event.venue || event.address)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 flex-shrink-0 font-medium">
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
})
