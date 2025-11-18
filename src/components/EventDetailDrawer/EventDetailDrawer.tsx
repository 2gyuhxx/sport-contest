import { formatDate } from '../../utils/formatDate'
import type { Event } from '../../types/events'
import { ExternalLink } from 'lucide-react'

interface EventDetailDrawerProps {
  event: Event | null
  onClose: () => void
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  if (!event) return null

  // 신청하기 버튼 핸들러
  const handleApply = () => {
    if (event?.link) {
      // website URL이 있으면 새 탭에서 열기
      window.open(event.link, '_blank', 'noopener,noreferrer')
    } else {
      // URL이 없으면 알림 표시
      alert('신청 URL이 등록되지 않았습니다.')
    }
  }

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
          {event.link && (
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              웹사이트 바로가기
            </a>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={!event.link}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {event.link ? (
                <>
                  <ExternalLink className="h-4 w-4" />
                  신청하기
                </>
              ) : (
                '신청 URL 없음'
              )}
            </button>
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
