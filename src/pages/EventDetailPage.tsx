import { useMemo, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { formatDate } from '../utils/formatDate'

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const {
    state: { events, regions },
    dispatch,
  } = useEventContext()

  // 조회수 증가 중복 실행 방지를 위한 ref (Set으로 여러 이벤트 추적)
  const viewProcessedRef = useRef<Set<string>>(new Set())

  const event = useMemo(() => events.find((item) => item.id === eventId), [eventId, events])
  const regionLabel = useMemo(
    () => regions.find((region) => region.id === event?.region)?.name ?? event?.region,
    [event?.region, regions],
  )

  // 조회수 증가 로직 (매 조회마다 증가)
  useEffect(() => {
    if (!eventId || !event) return

    // React Strict Mode 중복 실행 차단 (컴포넌트 마운트 시 1회만 실행)
    if (viewProcessedRef.current.has(eventId)) {
      return
    }
    viewProcessedRef.current.add(eventId)

    // 조회수 증가
    dispatch({ type: 'INCREMENT_VIEW', payload: eventId })
  }, [eventId, event, dispatch])

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
          </div>
        </header>

        <section className="grid gap-8 rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] md:p-10">
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-3xl">
              <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
            </div>
            <div className="rounded-3xl bg-surface p-6 text-sm leading-relaxed text-slate-600">
              {event.summary}
            </div>
            <div className="rounded-3xl border border-surface-subtle p-6 text-sm text-slate-600">
              <dl className="grid gap-4">
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
                  <dd>{event.address}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    문의
                  </dt>
                  <dd>contact@example.com · 02-1234-5678</dd>
                </div>
              </dl>
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-3xl border border-surface-subtle p-5 shadow-sm">
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                참여 신청
              </p>
              <p className="text-slate-900">{event.title}</p>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow hover:bg-brand-secondary"
            >
              신청하기
            </button>
            <button
              type="button"
              className="rounded-2xl border border-surface-subtle px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary"
            >
              공유하기
            </button>
            <button
              type="button"
              className="rounded-2xl border border-surface-subtle px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary"
            >
              관심 행사 등록
            </button>
          </aside>
        </section>
      </div>
    </div>
  )
}
