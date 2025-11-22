import { useState, useEffect } from 'react'
import { useAuthContext } from '../context/useAuthContext'
import { EventService } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import { AuthService } from '../services/AuthService'
import { Link, useNavigate } from 'react-router-dom'
import { 
  User, 
  Calendar, 
  MapPin, 
  Tag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  Heart
} from 'lucide-react'

interface MyEvent {
  id: number
  title: string
  description: string
  sport: string
  region: string
  sub_region: string
  venue: string | null
  start_at: string
  end_at: string
  status: 'pending' | 'approved' | 'spam'
  eraser: 'active' | 'inactive' | null
  created_at: string
  updated_at: string | null
}

export function MyPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useAuthContext()
  const { user, isAuthenticated } = state
  const isManager = !!user?.manager
  const [events, setEvents] = useState<MyEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEvents, setShowEvents] = useState(false) // 행사 목록 표시 여부
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null) // 삭제 중인 행사 ID
  
  // 찜 목록 상태
  const [favoriteEvents, setFavoriteEvents] = useState<any[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
  const [removingFavoriteId, setRemovingFavoriteId] = useState<number | null>(null)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeModalMessage, setRemoveModalMessage] = useState('')

  // 찜 목록 로드 함수
  const loadFavorites = async () => {
    if (!isAuthenticated) return
    
    try {
      setIsLoadingFavorites(true)
      const favorites = await FavoriteService.getMyFavorites()
      setFavoriteEvents(favorites)
    } catch (err) {
      console.error('찜 목록 로드 오류:', err)
    } finally {
      setIsLoadingFavorites(false)
    }
  }

  // 찜 삭제 핸들러
  const handleRemoveFavorite = async (eventId: number, eventTitle: string) => {
    try {
      setRemovingFavoriteId(eventId)
      await FavoriteService.removeFavorite(eventId)
      
      // 목록에서 제거
      setFavoriteEvents(prev => prev.filter(fav => fav.id !== eventId))
      setRemoveModalMessage('찜 목록에서 제거되었습니다')
      setShowRemoveModal(true)
    } catch (err) {
      console.error('찜 삭제 오류:', err)
      setRemoveModalMessage('찜 삭제 중 오류가 발생했습니다')
      setShowRemoveModal(true)
    } finally {
      setRemovingFavoriteId(null)
    }
  }

  // 페이지 로드 시 찜 목록 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites()
    }
  }, [isAuthenticated])

  // 행사 목록 로드 함수
  const loadMyEvents = async () => {
    // 로그인 안 했거나, 일반 사용자이면 행사 목록은 로딩하지 않음
    if (!isAuthenticated || !isManager) {
      setIsLoading(false)
      setEvents([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const myEvents = await EventService.getMyEvents()
      setEvents(myEvents)
      setShowEvents(true) // 행사 목록 표시
    } catch (err) {
      console.error('내 행사 목록 로딩 오류:', err)
      const errorMessage = err instanceof Error ? err.message : '행사 목록을 불러오는데 실패했습니다'
      setError(errorMessage)
      setShowEvents(true) // 에러가 나도 섹션은 표시
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // 행사 목록은 자동으로 로드하지 않음 (버튼 클릭 시에만 로드)
    
    // pending 상태의 행사가 있으면 3초마다 자동 새로고침
    // 관리자이면서 pending 상태의 행사가 있을 때만 자동 새로고침
    if (!isAuthenticated || !isManager || !showEvents) {
      return
    }

    const interval = setInterval(async () => {
      try {
        const myEvents = await EventService.getMyEvents()
        const hasPending = myEvents.some((event) => event.status === 'pending')
        if (hasPending) {
          setEvents(myEvents)
        }
      } catch (err) {
        // 조용히 실패 (에러는 표시하지 않음)
        console.error('자동 새로고침 오류:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isAuthenticated, isManager, showEvents])

  // 상태에 따른 배지 스타일
  const getStatusBadge = (status: MyEvent['status']) => {
    switch (status) {
      case 'pending':
        return {
          icon: Loader2,
          text: '판정 중',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          iconColor: 'text-yellow-600 animate-spin',
        }
      case 'approved':
        return {
          icon: CheckCircle2,
          text: '정상 등록',
          color: 'bg-green-100 text-green-800 border-green-300',
          iconColor: 'text-green-600',
        }
      case 'spam':
        return {
          icon: XCircle,
          text: '스팸 처리',
          color: 'bg-red-100 text-red-800 border-red-300',
          iconColor: 'text-red-600',
        }
      default:
        return {
          icon: AlertCircle,
          text: '알 수 없음',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          iconColor: 'text-gray-600',
        }
    }
  }

  // eraser 상태에 따른 배지 스타일
  const getEraserBadge = (eraser: MyEvent['eraser']) => {
    // null, undefined인 경우 null 반환
    if (eraser === null || eraser === undefined) {
      return null
    }
    
    // 문자열로 정규화 (공백 제거 및 소문자 변환)
    const normalizedEraser = String(eraser).trim().toLowerCase()
    
    switch (normalizedEraser) {
      case 'active':
        return {
          icon: CheckCircle2,
          text: '진행',
          color: 'bg-green-100 text-green-800 border-green-300',
          iconColor: 'text-green-600',
        }
      case 'inactive':
        return {
          icon: XCircle,
          text: '종료',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          iconColor: 'text-gray-600',
        }
      default:
        return null
    }
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // 권한 체크
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">로그인이 필요합니다</h1>
          <p className="mb-6 text-slate-600">마이페이지를 보려면 로그인해주세요.</p>
          <Link
            to="/login"
            className="inline-block rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
          >
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  const handleChangeInterests = () => {
    // 관심종목 수정 모드로 이동
    navigate('/oauth/signup?mode=interests')
  }

  const handleDeleteAccount = async () => {
    // 확인 다이얼로그
    const confirmed = window.confirm(
      '정말 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 계정 정보와 등록한 행사가 삭제되며, 복구할 수 없습니다.'
    )

    if (!confirmed) {
      return
    }

    try {
      // 회원탈퇴 API 호출
      await AuthService.deleteAccount()

      // 로그아웃 처리 (로컬 스토리지 정리는 deleteAccount에서 이미 처리됨)
      await AuthService.logout()

      // AuthContext 상태 업데이트
      dispatch({ type: 'LOGOUT' })

      // 홈페이지로 리다이렉트
      navigate('/')
      
      // 성공 메시지 (홈페이지로 이동한 후 표시)
      alert('회원탈퇴가 완료되었습니다.')
    } catch (error) {
      console.error('회원탈퇴 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '회원탈퇴 중 오류가 발생했습니다'
      alert(errorMessage)
    }
  }

  // 행사 삭제 핸들러
  const handleDeleteEvent = async (eventId: number, eventTitle: string) => {
    // 확인 다이얼로그
    const confirmed = window.confirm(
      `정말 "${eventTitle}" 행사를 삭제하시겠습니까?\n\n삭제된 행사는 복구할 수 없습니다.`
    )

    if (!confirmed) {
      return
    }

    try {
      setDeletingEventId(eventId)
      await EventService.deleteEvent(eventId)
      
      // 삭제 성공 시 행사 목록에서 제거
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId))
      
      alert('행사가 삭제되었습니다.')
    } catch (error) {
      console.error('행사 삭제 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '행사 삭제 중 오류가 발생했습니다'
      alert(errorMessage)
    } finally {
      setDeletingEventId(null)
    }
  }

  return (
    <>
      {/* 찜 제거 성공 모달 */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  removeModalMessage.includes('오류') ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {removeModalMessage.includes('오류') ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {removeModalMessage.includes('오류') ? '오류' : '완료'}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                {removeModalMessage}
              </p>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8 pb-16">
        {/* 헤더 */}
        <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-white md:p-12">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold md:text-4xl">마이페이지</h1>
              <p className="mt-2 text-white/90">
                {isManager
                  ? `${user?.name}님이 등록한 행사와 관리자 기능을 관리할 수 있습니다`
                  : `${user?.name}님의 프로필과 관심 종목을 관리할 수 있습니다`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 역할별 메인 섹션 */}
      <section className="mx-auto max-w-3xl space-y-8">
        {/* 공통: 계정 관리 카드 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {isManager ? '관리자 계정 관리' : '내 계정 관리'}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-800 transition hover:border-red-300 hover:bg-red-100"
            >
              <div>
                <p className="font-semibold">회원탈퇴</p>
                <p className="mt-1 text-xs text-red-700">
                  계정을 완전히 삭제하고 서비스를 더 이상 이용하지 않습니다.
                </p>
              </div>
              <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
            </button>

            {isManager ? (
              <button
                type="button"
                onClick={async () => {
                  // 행사 목록이 아직 로드되지 않았다면 로드
                  if (!showEvents) {
                    await loadMyEvents()
                  }
                  // 등록한 행사 목록 섹션으로 스크롤
                  setTimeout(() => {
                    const eventListSection = document.getElementById('my-events-section')
                    if (eventListSection) {
                      eventListSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }, 100)
                }}
                className="flex items-center justify-between rounded-2xl border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-left text-sm text-slate-800 transition hover:border-brand-primary hover:bg-brand-primary/10"
              >
                <div>
                  <p className="font-semibold">등록한 행사 확인하기</p>
                  <p className="mt-1 text-xs text-slate-600">
                    등록한 행사를 확인하고 수정할 수 있습니다.
                  </p>
                </div>
                <Calendar className="h-5 w-5 flex-shrink-0 text-brand-primary" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleChangeInterests}
                className="flex items-center justify-between rounded-2xl border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-left text-sm text-slate-800 transition hover:border-brand-primary hover:bg-brand-primary/10"
              >
                <div>
                  <p className="font-semibold">관심 종목 변경하기</p>
                  <p className="mt-1 text-xs text-slate-600">
                    관심 있는 체육 종목과 사용자 유형을 다시 선택할 수 있습니다.
                  </p>
                </div>
                <Tag className="h-5 w-5 flex-shrink-0 text-brand-primary" />
              </button>
            )}
          </div>
        </div>

        {/* 찜 목록 관리 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">찜 목록 관리</h2>
          
          {isLoadingFavorites ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-primary" />
                <p className="mt-2 text-sm text-slate-600">찜 목록을 불러오는 중...</p>
              </div>
            </div>
          ) : favoriteEvents.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="text-center">
                <Heart className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-sm text-slate-600">찜한 행사가 없습니다.</p>
                <Link
                  to="/"
                  className="mt-2 inline-block text-sm text-brand-primary hover:underline"
                >
                  행사 둘러보기 →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {favoriteEvents.map((event) => (
                <div
                  key={event.id}
                  className="group relative flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-primary hover:shadow-md"
                >
                  <Link to={`/events/${event.id}`} className="flex-1 min-w-0">
                    {/* 행사 정보 */}
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-slate-900 line-clamp-1">{event.title}</h3>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Tag className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.sport}</span>
                        {event.sub_sport && (
                          <>
                            <span>·</span>
                            <span className="truncate">{event.sub_sport}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.region} {event.sub_region}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>{new Date(event.start_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                  </Link>
                  
                  {/* 찜 해제 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(event.id, event.title)}
                    disabled={removingFavoriteId === event.id}
                    className="ml-3 flex-shrink-0 rounded-full p-2 transition hover:bg-red-50 disabled:opacity-50"
                    title="찜 해제"
                  >
                    {removingFavoriteId === event.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                      <Heart className="h-5 w-5 fill-red-500 text-red-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 관리자용: 등록한 행사 목록 */}
        {isManager && showEvents && (
          <div id="my-events-section">
            {isLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-primary" />
                  <p className="mt-4 text-slate-600">행사 목록을 불러오는 중...</p>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
                <h2 className="mt-4 text-xl font-semibold text-red-900">오류 발생</h2>
                <p className="mt-2 text-red-700">{error}</p>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
                <Calendar className="mx-auto h-16 w-16 text-slate-400" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900">등록한 행사가 없습니다</h2>
                <p className="mt-2 text-slate-600">새로운 행사를 등록해보세요!</p>
                <Link
                  to="/admin/events/create"
                  className="mt-6 inline-block rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
                >
                  행사 등록하기
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => {
                  const statusBadge = getStatusBadge(event.status)
                  const StatusIcon = statusBadge.icon
                  const eraserBadge = getEraserBadge(event.eraser)
                  const EraserIcon = eraserBadge?.icon

                  return (
                    <div
                      key={event.id}
                      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* 수정/삭제 버튼 */}
                          <div className="mb-3 flex justify-end gap-2">
                            <Link
                              to={`/admin/events/edit/${event.id}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                              수정
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event.id, event.title)}
                              disabled={deletingEventId === event.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4" />
                              {deletingEventId === event.id ? '삭제 중...' : '삭제'}
                            </button>
                          </div>
                          {/* 제목과 상태 */}
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <Link
                              to={`/events/${event.id}`}
                              className="text-xl font-bold text-slate-900 hover:text-brand-primary transition-colors cursor-pointer"
                            >
                              {event.title}
                            </Link>
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.color}`}
                              >
                                <StatusIcon className={`h-3.5 w-3.5 ${statusBadge.iconColor}`} />
                                <span>{statusBadge.text}</span>
                              </div>
                              {eraserBadge && EraserIcon && (
                                <div
                                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${eraserBadge.color}`}
                                >
                                  <EraserIcon className={`h-3.5 w-3.5 ${eraserBadge.iconColor}`} />
                                  <span>{eraserBadge.text}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 설명 */}
                          <p className="mb-4 text-slate-600 line-clamp-2">{event.description}</p>

                          {/* 정보 */}
                          <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-slate-400" />
                              <span>{event.sport}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span>
                                {event.region} {event.sub_region}
                                {event.venue && ` · ${event.venue}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              <span>
                                {formatDate(event.start_at)} ~ {formatDate(event.end_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span>등록일: {formatDate(event.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
    </>
  )
}

