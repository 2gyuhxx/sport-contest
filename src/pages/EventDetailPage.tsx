import { useMemo, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { formatDate } from '../utils/formatDate'
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react'
import { EventService } from '../services/EventService'

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const {
    state: { events, regions },
    dispatch,
  } = useEventContext()
  
  // 조회수 증가가 한 번만 실행되도록 추적
  const viewCountedRef = useRef(false)

  const event = useMemo(() => events.find((item) => item.id === eventId), [eventId, events])
  const regionLabel = useMemo(
    () => regions.find((region) => region.id === event?.region)?.name ?? event?.region,
    [event?.region, regions],
  )

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

  // 조회수 증가 (React Strict Mode에서도 한 번만 실행)
  useEffect(() => {
    if (eventId && !viewCountedRef.current) {
      viewCountedRef.current = true
      
      // 서버에 조회수 증가 요청 및 업데이트된 조회수로 로컬 상태 동기화
      EventService.incrementEventViews(eventId).then((result) => {
        if (result) {
          // 서버에서 받은 정확한 조회수로 업데이트
          dispatch({ type: 'UPDATE_EVENT_VIEWS', payload: { eventId, views: result.views } })
          console.log(`[조회수] 행사 ${eventId} 서버 동기화 완료 (조회수: ${result.views})`)
        }
      }).catch((error) => {
        console.error('[조회수] 서버 동기화 실패:', error)
      })
    }
  }, [eventId, dispatch])

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface text-center text-slate-600">
        <p className="text-lg">행사를 찾을 수 없습니다.</p>
        <button
          type="button"
          className="mt-6 rounded-full bg-brand-primary px-5 py-2 text-sm font-semibold text-white"
          onClick={() => navigate(-1)}
        >
          이전 페이지로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="bg-surface pb-20 pt-10">
      <div className="mx-auto flex max-w-content flex-col gap-10 px-4 lg:gap-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">event detail</p>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">{event.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {regionLabel} · {event.city}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-white px-3 py-1 shadow">{event.category}</span>
            <span className="rounded-full bg-white px-3 py-1 shadow">
              조회수 {event.views.toLocaleString()}
            </span>
            {/* 진행/종료 상태 배지 */}
            {event.event_status && (
              <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                event.event_status === 'active'
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-gray-100 text-gray-800 border-gray-300'
              }`}>
                {event.event_status === 'active' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>진행</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    <span>종료</span>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="grid gap-8 rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] md:p-10">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-3xl">
              <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            {/* 행사 설명 */}
            <div className="rounded-3xl bg-surface p-5 text-sm leading-relaxed text-slate-600">
              {event.summary}
            </div>

            {/* 행사 정보 */}
            <div className="rounded-3xl border border-surface-subtle p-5 shadow-sm">
              <dl className="grid gap-4 text-sm text-slate-600">
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    행사 일시
                  </dt>
                  <dd className="text-slate-900">{formatDate(event.date)}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    장소
                  </dt>
                  <dd className="text-slate-900">{event.venue || event.address}</dd>
                </div>
                {event.organizer && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      주최
                    </dt>
                    <dd className="text-slate-900">{event.organizer}</dd>
                  </div>
                )}
                {event.link && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      웹사이트
                    </dt>
                    <dd>
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                      >
                        <span className="truncate">{event.link}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 참여 신청 */}
            <div className="rounded-3xl border border-surface-subtle p-5 shadow-sm">
              <div className="mb-4 rounded-2xl bg-surface px-4 py-3 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  참여 신청
                </p>
                <p className="text-slate-900">{event.title}</p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={!event.link}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
                className="mb-3 w-full rounded-2xl border border-surface-subtle px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary"
              >
                공유하기
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-surface-subtle px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary"
              >
                관심 행사 등록
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
