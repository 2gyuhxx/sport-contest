import { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Event } from '../../types/events'
import { formatDate, formatDateShort } from '../../utils/formatDate'
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
      ? 'rounded-lg md:rounded-xl border-2 border-slate-200 bg-white hover:border-brand-primary hover:shadow-md flex flex-row'
      : 'rounded-2xl border bg-white shadow-sm hover:shadow-elevate',
    !isCompact && 'hover:border-brand-primary',
    isActive ? 'ring-2 ring-brand-primary' : '',
    !isCompact && (effectiveLayout === 'horizontal' ? 'flex flex-col md:flex-row' : 'flex flex-col h-full'),
  )

  const imageClasses = classNames(
    'relative overflow-hidden',
    isCompact
      ? 'hidden md:flex md:w-32 lg:w-40 h-auto flex-shrink-0 rounded-l-xl'
      : effectiveLayout === 'horizontal'
        ? 'h-48 w-full md:h-auto md:basis-1/2 flex-shrink-0'
        : 'h-44 w-full',
  )

  const bodyPadding = isCompact ? 'p-2.5 sm:p-4 md:p-5' : 'p-5'

  const card = (
    <article
      onClick={handleClick}
      className={containerClasses}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={isActive || undefined}
    >
      {!isCompact && (
        <div className={classNames(imageClasses, 'bg-slate-50')}>
          <img
            src={(event.image && event.image.trim() !== '') 
              ? event.image 
              : getDefaultImage(event.sub_sport, event.sport, event.category)}
            alt={event.title}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-brand-secondary shadow-sm bg-white/90">
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
      )}
      
      {/* 데스크탑에서만 이미지 표시 (compact 모드) */}
      {isCompact && (
        <div className={classNames(imageClasses, 'bg-slate-50')}>
          <img
            src={(event.image && event.image.trim() !== '') 
              ? event.image 
              : getDefaultImage(event.sub_sport, event.sport, event.category)}
            alt={event.title}
            className="h-full w-full object-contain transition duration-200"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      <div className={classNames('flex flex-col', bodyPadding, isCompact ? 'gap-1.5 flex-1' : 'gap-2 flex-1')}>
        {/* compact 모드일 때: 카테고리와 진행 상태 배지 */}
        {isCompact && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide text-brand-secondary bg-blue-50 border border-blue-200">
              {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category || ''}
            </span>
            {event.event_status && (
              <div className={classNames(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                event.event_status === 'active'
                  ? 'bg-green-50 text-green-700 border-green-300'
                  : 'bg-gray-50 text-gray-600 border-gray-300'
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
        )}
        
        <header className="flex flex-col gap-2">
          {/* 모바일: 제목과 배지를 세로로 배치, 데스크탑: 가로로 배치 */}
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
            <h3
              className={classNames(
                'font-bold text-slate-900',
                isCompact 
                  ? 'text-base sm:text-lg leading-snug line-clamp-3 flex-1' 
                  : 'text-base sm:text-lg md:text-xl leading-snug line-clamp-3 md:line-clamp-2 md:min-h-[3.5rem] flex-1',
              )}
            >
              {event.title}
            </h3>
            {/* D-day 배지 */}
            {ddayInfo && (
              <span
                className={classNames(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold whitespace-nowrap self-start md:flex-shrink-0',
                  isCompact ? 'text-xs sm:text-sm' : 'text-xs',
                  ddayInfo.isPast
                    ? 'bg-gray-100 text-gray-600'
                    : ddayInfo.daysLeft === 0
                      ? 'bg-red-500 text-white shadow-md'
                      : ddayInfo.daysLeft <= 3
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-blue-500 text-white shadow-md'
                )}
              >
                <Clock className={classNames(isCompact ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-3 w-3')} />
                {ddayInfo.text}
              </span>
            )}
          </div>
          <div className={classNames('text-slate-600', isCompact ? 'text-xs sm:text-sm' : 'text-sm')}>
            <p className="font-medium break-words">
              📅 {event.city}
            </p>
            <p className="text-xs mt-0.5 break-words">
              {isCompact ? (
                <>
                  {event.start_at ? formatDateShort(event.start_at) : formatDateShort(event.date)}
                  {event.end_at && event.start_at !== event.end_at && (
                    <> ~ {formatDateShort(event.end_at)}</>
                  )}
                </>
              ) : (
                <>
                  {event.start_at ? formatDate(event.start_at) : formatDate(event.date)}
                  {event.end_at && event.start_at !== event.end_at && (
                    <> ~ {formatDate(event.end_at)}</>
                  )}
                </>
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
