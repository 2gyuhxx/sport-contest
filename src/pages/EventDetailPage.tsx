import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { formatDate } from '../utils/formatDate'
import { ExternalLink, CheckCircle2, XCircle, Heart } from 'lucide-react'
import { EventService, categoryToKoreanMap } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import { FavoriteModal } from '../components/FavoriteModal'

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const {
    state: { events, regions },
    dispatch,
  } = useEventContext()
  const { state: authState } = useAuthContext()
  const { isAuthenticated } = authState
  
  // 조회수 증가가 한 번만 실행되도록 추적
  const viewCountedRef = useRef(false)
  
  // 찜 상태
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false)
  const [showFavoriteModal, setShowFavoriteModal] = useState(false)
  const [favoriteModalMessage, setFavoriteModalMessage] = useState('')

  const event = useMemo(() => events.find((item) => item.id === eventId), [eventId, events])
  const regionLabel = useMemo(
    () => regions.find((region) => region.id === event?.region)?.name ?? event?.region,
    [event?.region, regions],
  )

  // 조회수 증가 (React Strict Mode에서도 한 번만 실행)
  useEffect(() => {
    if (eventId && !viewCountedRef.current) {
      viewCountedRef.current = true
      
      // 서버에 조회수 증가 요청 및 업데이트된 조회수로 로컬 상태 동기화
      EventService.incrementEventViews(eventId).then((result) => {
        if (result) {
          // 서버에서 받은 정확한 조회수로 업데이트
          dispatch({ type: 'UPDATE_EVENT_VIEWS', payload: { eventId, views: result.views } })
        }
      }).catch((error) => {
        console.error('[조회수] 서버 동기화 실패:', error)
      })
    }
  }, [eventId, dispatch])

  // 찜 상태 확인
  useEffect(() => {
    if (isAuthenticated && eventId) {
      setIsLoadingFavorite(true)
      FavoriteService.checkFavorite(parseInt(eventId, 10))
        .then(setIsFavorite)
        .catch((error) => console.error('찜 상태 확인 실패:', error))
        .finally(() => setIsLoadingFavorite(false))
    } else {
      setIsFavorite(false)
    }
  }, [isAuthenticated, eventId])

  // 찜 토글 핸들러
  const handleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteModalMessage('로그인이 필요합니다')
      setShowFavoriteModal(true)
      return
    }

    if (!eventId) return

    setIsLoadingFavorite(true)
    try {
      const response = await FavoriteService.toggleFavorite(parseInt(eventId, 10), isFavorite)
      setIsFavorite(!isFavorite)
      setFavoriteModalMessage(response.message || (isFavorite ? '관심 행사에서 제거되었습니다' : '관심 행사로 등록되었습니다'))
      setShowFavoriteModal(true)
    } catch (error: any) {
      console.error('찜 토글 오류:', error)
      setFavoriteModalMessage(error.message || '찜 기능 처리 중 오류가 발생했습니다.')
      setShowFavoriteModal(true)
    } finally {
      setIsLoadingFavorite(false)
    }
  }, [isAuthenticated, eventId, isFavorite])

  // 모달 확인 핸들러
  const handleCloseModal = useCallback(() => {
    setShowFavoriteModal(false)
    if (favoriteModalMessage === '로그인이 필요합니다') {
      navigate('/login')
    }
  }, [favoriteModalMessage, navigate])

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
    <>
      {/* 찜 성공/실패 모달 */}
      <FavoriteModal
        isOpen={showFavoriteModal}
        message={favoriteModalMessage}
        onClose={handleCloseModal}
      />

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
            <span className="rounded-full bg-white px-3 py-1 shadow">
              {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category}
            </span>
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
              <img
                src={event.image}
                alt={event.title}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            {/* 관심 행사 등록 버튼 */}
            <button
              type="button"
              onClick={handleFavorite}
              disabled={isLoadingFavorite}
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition flex items-center justify-center gap-2 ${
                isFavorite
                  ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600'
                  : 'border-surface-subtle text-slate-700 hover:border-brand-primary hover:text-brand-primary'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoadingFavorite ? (
                '처리 중...'
              ) : (
                <>
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-white' : 'fill-none'}`} />
                  {isFavorite ? '관심 행사 등록됨' : '관심 행사 등록'}
                </>
              )}
            </button>

            {/* 행사 설명 */}
            <div className="break-words whitespace-pre-wrap rounded-3xl bg-surface p-5 text-sm leading-relaxed text-slate-600">
              {event.summary}
            </div>

            {/* 행사 정보 */}
            <div className="rounded-3xl border border-surface-subtle p-5 shadow-sm">
              <dl className="grid gap-4 text-sm text-slate-600">
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    행사 일시
                  </dt>
                  <dd className="break-words text-slate-900">{formatDate(event.date)}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    장소
                  </dt>
                  <dd className="break-words text-slate-900">{event.venue || event.address}</dd>
                </div>
                {event.organizer && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      주최
                    </dt>
                    <dd className="break-words text-slate-900">{event.organizer}</dd>
                  </div>
                )}
                {event.link && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      웹사이트
                    </dt>
                    <dd className="break-all">
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 text-brand-primary hover:underline"
                      >
                        <span className="break-all">{event.link}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </div>
    </>
  )
}
