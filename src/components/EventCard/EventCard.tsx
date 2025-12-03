import { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Event } from '../../types/events'
import { formatDateShort } from '../../utils/formatDate'
import { classNames } from '../../utils/classNames'
import { Clock, MapPin, Calendar } from 'lucide-react'
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
  variant?: 'default' | 'featured' | 'compact'
  detailHref?: string
}

export const EventCard = memo(function EventCard({
  event,
  onSelect,
  isActive = false,
  variant = 'default',
  detailHref,
}: EventCardProps) {
  const handleClick = useCallback(() => {
    onSelect?.(event)
  }, [event, onSelect])

  const deadlineDate = event.registration_deadline || event.end_at
  const ddayInfo = deadlineDate ? calculateDday(deadlineDate) : null
  const isFeatured = variant === 'featured'
  const isCompact = variant === 'compact'
  
  const imageUrl = (event.image && event.image.trim() !== '') 
    ? event.image 
    : getDefaultImage(event.sub_sport, event.sport, event.category)

  // Apple-style: 보더 없는 흰색 카드, 호버 시 떠있는 효과
  const card = (
    <article
      onClick={handleClick}
      className={classNames(
        'floating-card group cursor-pointer overflow-hidden transition-all duration-300',
        isActive ? 'ring-2 ring-[#2563EB] ring-offset-4' : '',
        isFeatured ? 'col-span-2 row-span-2' : '',
        isCompact ? 'col-span-1 row-span-1' : ''
      )}
      role={onSelect ? 'button' : undefined}
    >
      {/* Featured 카드: Full-bleed 배경 이미지 */}
      {isFeatured && (
        <div className="relative h-full min-h-[400px]">
          <img
            src={imageUrl}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = getDefaultImage(event.sub_sport, event.sport, event.category)
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Featured 콘텐츠 */}
          <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
            <div className="mb-4">
              <span className="pill-chip bg-white/20 backdrop-blur-sm text-white border-0">
                {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category || ''}
              </span>
            </div>
            <h3 className="text-3xl font-bold mb-4 line-clamp-2 drop-shadow-lg">
              {event.title}
            </h3>
            <div className="flex items-center gap-4 text-white/90 mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{event.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {event.start_at ? formatDateShort(event.start_at) : formatDateShort(event.date)}
                </span>
              </div>
            </div>
            {ddayInfo && (
              <div className={classNames(
                'pill-chip inline-flex items-center gap-1.5',
                ddayInfo.isPast
                  ? 'bg-white/20 text-white'
                  : ddayInfo.daysLeft === 0
                    ? 'bg-red-500/90 text-white'
                    : ddayInfo.daysLeft <= 3
                      ? 'bg-orange-500/90 text-white'
                      : 'bg-[#2563EB]/90 text-white'
              )}>
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{ddayInfo.text}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact 카드: 작은 정보 카드 */}
      {isCompact && !isFeatured && (
        <div className="p-4">
          <div className="mb-2">
            <span className="pill-chip bg-gray-100 text-gray-700 text-xs">
              {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category || ''}
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <MapPin className="h-3 w-3" />
            <span>{event.city}</span>
          </div>
          {ddayInfo && (
            <div className="mt-3">
              <span className={classNames(
                'pill-chip text-xs inline-flex items-center gap-1.5',
                ddayInfo.isPast
                  ? 'bg-gray-500/90 text-white'
                  : ddayInfo.daysLeft === 0
                    ? 'bg-red-500/90 text-white'
                    : ddayInfo.daysLeft <= 3
                      ? 'bg-orange-500/90 text-white'
                      : 'bg-[#2563EB]/90 text-white'
              )}>
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{ddayInfo.text}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* 일반 카드: 흰색 배경 */}
      {!isFeatured && !isCompact && (
        <>
          {/* 썸네일 */}
          <div className="relative w-full aspect-video bg-gray-100 overflow-hidden">
            <img
              src={imageUrl}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = getDefaultImage(event.sub_sport, event.sport, event.category)
              }}
            />
            
            {/* 카테고리 배지 */}
            <div className="absolute top-4 left-4">
              <span className="pill-chip bg-white/95 text-gray-700">
                {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category || ''}
              </span>
            </div>
            
            {/* D-Day 배지 */}
            {ddayInfo && (
              <div className="absolute top-4 right-4">
                <span className={classNames(
                  'pill-chip inline-flex items-center gap-1.5',
                  ddayInfo.isPast
                    ? 'bg-gray-500/90 text-white'
                    : ddayInfo.daysLeft === 0
                      ? 'bg-red-500/90 text-white'
                      : ddayInfo.daysLeft <= 3
                        ? 'bg-orange-500/90 text-white'
                        : 'bg-[#2563EB]/90 text-white'
                )}>
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{ddayInfo.text}</span>
                </span>
              </div>
            )}
          </div>

          {/* 콘텐츠 */}
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 line-clamp-2 group-hover:text-[#2563EB] transition-colors">
              {event.title}
            </h3>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{event.city}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>
                  {event.start_at ? formatDateShort(event.start_at) : formatDateShort(event.date)}
                  {event.end_at && event.start_at !== event.end_at && (
                    <> ~ {formatDateShort(event.end_at)}</>
                  )}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </article>
  )

  if (detailHref) {
    return (
      <Link to={detailHref} className="block h-full">
        {card}
      </Link>
    )
  }

  return card
})
