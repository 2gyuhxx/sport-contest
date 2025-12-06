import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import { formatDate } from '../utils/formatDate'
import { ExternalLink, CheckCircle2, XCircle, Heart, AlertTriangle, X, HelpCircle, ArrowLeft } from 'lucide-react'
import { EventService, categoryToKoreanMap, transformDBEventToEvent } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import { FavoriteModal } from '../components/FavoriteModal'
import type { Event } from '../types/events'
import { getDefaultImage } from '../utils/defaultImages'

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

  // 신고 상태
  const [hasReported, setHasReported] = useState(false)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [showCancelReportModal, setShowCancelReportModal] = useState(false)

  // EventContext에서 행사 찾기 또는 API에서 가져오기
  const [fetchedEvent, setFetchedEvent] = useState<Event | null>(null)
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  
  const eventFromContext = useMemo(() => events.find((item) => item.id === eventId), [eventId, events])
  const event: Event | null = eventFromContext || fetchedEvent
  
  const regionLabel = useMemo(
    () => regions.find((region) => region.id === event?.region)?.name ?? event?.region,
    [event?.region, regions],
  )

  // 이미지 URL 메모이제이션
  const eventImageUrl = useMemo(() => {
    if (!event) return ''
    return (event.image && event.image.trim() !== '') 
      ? event.image 
      : getDefaultImage(event.sub_sport, event.sport, event.category)
  }, [event?.image, event?.sub_sport, event?.sport, event?.category])

  // EventContext에 없으면 API에서 가져오기
  useEffect(() => {
    if (!eventFromContext && eventId && !isLoadingEvent && !fetchedEvent) {
      setIsLoadingEvent(true)
      EventService.getEventById(parseInt(eventId, 10))
        .then((dbEvent) => {
          const transformedEvent = transformDBEventToEvent(dbEvent)
          setFetchedEvent(transformedEvent)
          // EventContext에도 추가
          dispatch({ type: 'ADD_EVENT', payload: transformedEvent })
        })
        .catch((error) => {
          console.error('행사 조회 오류:', error)
        })
        .finally(() => {
          setIsLoadingEvent(false)
        })
    }
  }, [eventId, eventFromContext, isLoadingEvent, fetchedEvent, dispatch])

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

  // 신고 상태 확인
  useEffect(() => {
    if (isAuthenticated && eventId) {
      setIsLoadingReport(true)
      EventService.checkUserReport(parseInt(eventId, 10))
        .then((report) => setHasReported(report !== null))
        .catch((error) => console.error('신고 상태 확인 실패:', error))
        .finally(() => setIsLoadingReport(false))
    } else {
      setHasReported(false)
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
    const shouldNavigateToLogin = favoriteModalMessage === '로그인이 필요합니다.'
    setShowFavoriteModal(false)
    if (shouldNavigateToLogin) {
      navigate('/login')
    }
  }, [favoriteModalMessage, navigate])

  // 신고 핸들러
  const handleReport = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteModalMessage('로그인이 필요합니다.')
      setShowFavoriteModal(true)
      return
    }

    if (!eventId || !reportReason.trim()) {
      setFavoriteModalMessage('신고 사유를 입력해주세요.')
      setShowFavoriteModal(true)
      return
    }

    setIsSubmittingReport(true)
    try {
      const response = await EventService.reportEvent(parseInt(eventId, 10), reportReason)
      
      // 로컬 상태 업데이트
      dispatch({
        type: 'UPDATE_EVENT_REPORTS',
        payload: {
          eventId,
          reports_count: response.event.reports_count,
          reports_state: response.event.reports_state,
        },
      })
      
      setHasReported(true)
      setShowReportModal(false)
      setReportReason('')
      setFavoriteModalMessage('신고가 접수되었습니다.')
      setShowFavoriteModal(true)
    } catch (error: any) {
      console.error('신고 처리 중 오류:', error)
      setFavoriteModalMessage(error.message || '신고 처리 중 오류가 발생했습니다.')
      setShowFavoriteModal(true)
    } finally {
      setIsSubmittingReport(false)
    }
  }, [isAuthenticated, eventId, reportReason, dispatch, navigate, showFavoriteModal])

  // 신고 취소 확인 핸들러
  const handleCancelReportClick = useCallback(() => {
    if (!isAuthenticated) {
      setFavoriteModalMessage('로그인이 필요합니다.')
      setShowFavoriteModal(true)
      return
    }
    setShowCancelReportModal(true)
  }, [isAuthenticated])

  // 신고 취소 실행 핸들러
  const handleCancelReport = useCallback(async () => {
    if (!eventId) return

    setShowCancelReportModal(false)
    setIsLoadingReport(true)
    try {
      const response = await EventService.cancelReport(parseInt(eventId, 10))
      
      // 로컬 상태 업데이트
      dispatch({
        type: 'UPDATE_EVENT_REPORTS',
        payload: {
          eventId,
          reports_count: response.event.reports_count,
          reports_state: response.event.reports_state,
        },
      })
      
      setHasReported(false)
      setFavoriteModalMessage('신고가 취소되었습니다.')
      setShowFavoriteModal(true)
    } catch (error: any) {
      console.error('신고 취소 중 오류:', error)
      setFavoriteModalMessage(error.message || '신고 취소 중 오류가 발생했습니다.')
      setShowFavoriteModal(true)
    } finally {
      setIsLoadingReport(false)
    }
  }, [eventId, dispatch])

  // 로딩 중이면 로딩 표시
  if (isLoadingEvent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7FA] text-center text-[#8e8e93]">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-[#007AFF] border-t-transparent"></div>
        <p className="text-lg">행사를 불러오는 중...</p>
      </div>
    )
  }

  // 행사를 찾을 수 없으면 에러 표시
  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7FA] text-center text-[#8e8e93]">
        <p className="text-lg">행사를 찾을 수 없습니다.</p>
        <button
          type="button"
          className="mt-6 rounded-full bg-[#007AFF] px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0051D5] hover:shadow-[0_4px_12px_rgba(0,122,255,0.4)]"
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

      <div className="bg-[#F5F7FA] pb-8 pt-6">
        <div className="mx-auto flex max-w-content flex-col gap-6 px-4 md:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center rounded-full p-2 text-[#8e8e93] hover:bg-white/80 hover:text-[#1d1d1f] transition-all duration-200"
              title="뒤로가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-[#1d1d1f] md:text-4xl">{event.title}</h1>
              <p className="mt-2 text-sm text-[#8e8e93]">
                {regionLabel} · {event.city}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-white/95 backdrop-blur-xl border border-white/40 px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#1d1d1f]">
              {event.sub_sport || event.sport || categoryToKoreanMap[event.category] || event.category}
            </span>
            <span className="rounded-full bg-white/95 backdrop-blur-xl border border-white/40 px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[#8e8e93]">
              조회수 {event.views.toLocaleString()}
            </span>
            {/* 진행/종료 상태 배지 */}
            {event.event_status && (
              <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
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

        <section className="grid gap-8 rounded-[28px] border border-white/40 bg-white/95 backdrop-blur-xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] md:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] md:p-10" style={{ WebkitBackdropFilter: 'blur(40px)' }}>
          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-[20px]">
              <img
                src={eventImageUrl}
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
              className={`w-full rounded-full border px-4 py-3 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                isFavorite
                  ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600 hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)]'
                  : 'border-[#3c3c43]/10 bg-white text-[#1d1d1f] hover:border-[#007AFF]/30 hover:text-[#007AFF] hover:shadow-[0_2px_8px_rgba(0,122,255,0.15)]'
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

            {/* 신고 버튼 */}
            {hasReported ? (
              <button
                type="button"
                onClick={handleCancelReportClick}
                disabled={isLoadingReport}
                className="w-full rounded-full border border-red-300/50 bg-red-50/80 px-4 py-3 text-sm font-semibold text-red-600 transition-all duration-200 hover:bg-red-100 hover:shadow-[0_2px_8px_rgba(239,68,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingReport ? '처리 중...' : '신고 취소'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                disabled={isLoadingReport}
                className="w-full rounded-full border border-red-300/50 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 hover:shadow-[0_2px_8px_rgba(239,68,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                행사 신고하기
              </button>
            )}

            {/* 행사 설명 */}
            <div className="break-words whitespace-pre-wrap rounded-[20px] bg-[#767680]/5 border border-[#3c3c43]/10 p-5 text-sm leading-relaxed text-[#8e8e93]">
              {event.summary}
            </div>

            {/* 행사 정보 */}
            <div className="rounded-[20px] border border-white/40 bg-white/95 backdrop-blur-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <dl className="grid gap-4 text-sm text-[#8e8e93]">
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8e8e93]">
                    행사 일시
                  </dt>
                  <dd className="break-words text-[#1d1d1f]">
                    {event.start_at && formatDate(event.start_at)}
                    {event.end_at && event.start_at !== event.end_at && (
                      <> ~ {formatDate(event.end_at)}</>
                    )}
                    {!event.start_at && formatDate(event.date)}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8e8e93]">
                    장소
                  </dt>
                  <dd className="break-words text-[#1d1d1f]">{event.venue || event.address}</dd>
                </div>
                {event.organizer && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8e8e93]">
                      주최
                    </dt>
                    <dd className="break-words text-[#1d1d1f]">{event.organizer}</dd>
                  </div>
                )}
                {event.link && (
                  <div className="grid gap-1">
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8e8e93]">
                      웹사이트
                    </dt>
                    <dd className="break-all">
                      <a
                        href={event.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1 text-[#007AFF] hover:underline transition-colors"
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

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/40 bg-white/95 backdrop-blur-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]" style={{ WebkitBackdropFilter: 'blur(40px)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1d1d1f]">행사 신고</h2>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false)
                  setReportReason('')
                }}
                className="rounded-full p-1 text-[#8e8e93] hover:bg-[#767680]/10 hover:text-[#1d1d1f] transition-all duration-200"
                disabled={isSubmittingReport}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-[#8e8e93]">
              신고 사유를 입력해주세요. 부적절한 신고는 제재를 받을 수 있습니다.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="신고 사유를 입력해주세요..."
              className="mb-4 w-full rounded-[14px] border border-[#3c3c43]/10 bg-[#767680]/5 p-3 text-sm text-[#1d1d1f] focus:border-[#007AFF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all duration-200"
              rows={4}
              disabled={isSubmittingReport}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false)
                  setReportReason('')
                }}
                className="flex-1 rounded-full bg-[#767680]/10 px-4 py-2 text-sm font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#767680]/15"
                disabled={isSubmittingReport}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReport}
                className="flex-1 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 hover:shadow-[0_4px_12px_rgba(239,68,68,0.4)] disabled:opacity-50"
                disabled={isSubmittingReport || !reportReason.trim()}
              >
                {isSubmittingReport ? '처리 중...' : '신고하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 신고 취소 확인 모달 */}
      {showCancelReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="mx-4 w-full max-w-sm transform rounded-[28px] border border-white/40 bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all" style={{ WebkitBackdropFilter: 'blur(40px)' }}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <HelpCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1d1d1f]">신고 취소 확인</h3>
                </div>
              </div>
              <p className="text-sm text-[#8e8e93] mb-6">
                신고를 취소하시겠습니까?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCancelReportModal(false)}
                  className="flex-1 rounded-full bg-[#767680]/10 px-4 py-3 font-semibold text-[#1d1d1f] transition-all duration-200 hover:bg-[#767680]/15"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCancelReport}
                  className="flex-1 rounded-full bg-[#007AFF] px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-[#0051D5] hover:shadow-[0_4px_12px_rgba(0,122,255,0.4)]"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
