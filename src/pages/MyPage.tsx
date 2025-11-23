import { useState, useEffect } from 'react'
import { useAuthContext } from '../context/useAuthContext'
import { EventService } from '../services/EventService'
import { FavoriteService } from '../services/FavoriteService'
import { AuthService } from '../services/AuthService'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Calendar, 
  MapPin, 
  Tag, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Edit,
  Trash2,
  Heart,
  Key
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
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null) // 삭제 중인 행사 ID
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false) // 행사 삭제 확인 모달
  const [deleteEventModalMessage, setDeleteEventModalMessage] = useState('') // 행사 삭제 모달 메시지
  const [eventToDelete, setEventToDelete] = useState<{ id: number; title: string } | null>(null) // 삭제할 행사
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false) // 회원 탈퇴 모달
  const [deleteAccountModalMessage, setDeleteAccountModalMessage] = useState('') // 회원 탈퇴 모달 메시지
  const [isDeleteAccountConfirm, setIsDeleteAccountConfirm] = useState(false) // 회원 탈퇴 확인 단계
  
  // 비밀번호 변경 상태
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false) // 비밀번호 변경 모달
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false)

  // 비밀번호 강도 계산
  const getPasswordStrength = (password: string) => {
    if (!password) return { level: 0, text: '', color: '' }
    
    let strength = 0
    
    // 길이 체크
    if (password.length >= 6) strength += 1
    if (password.length >= 8) strength += 1
    if (password.length >= 10) strength += 1
    
    // 대문자 포함
    if (/[A-Z]/.test(password)) strength += 1
    
    // 소문자 포함
    if (/[a-z]/.test(password)) strength += 1
    
    // 숫자 포함
    if (/[0-9]/.test(password)) strength += 1
    
    // 특수문자 포함
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    
    if (strength <= 2) {
      return { level: 1, text: '위기', color: 'bg-red-500' }
    } else if (strength <= 4) {
      return { level: 2, text: '적정', color: 'bg-yellow-500' }
    } else {
      return { level: 3, text: '안전', color: 'bg-green-500' }
    }
  }

  const passwordStrength = getPasswordStrength(passwordData.newPassword)
  
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
  const handleRemoveFavorite = async (eventId: number) => {
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

  // 페이지 로드 시 찜 목록 또는 행사 목록 로드
  useEffect(() => {
    if (isAuthenticated) {
      if (isManager) {
        // 관리자는 행사 목록 로드
        loadMyEvents()
      } else {
        // 일반 사용자는 찜 목록 로드
        loadFavorites()
      }
    }
  }, [isAuthenticated, isManager])

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
    } catch (err) {
      console.error('내 행사 목록 로딩 오류:', err)
      const errorMessage = err instanceof Error ? err.message : '행사 목록을 불러오는데 실패했습니다'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // pending 상태의 행사가 있으면 3초마다 자동 새로고침
  useEffect(() => {
    if (!isAuthenticated || !isManager || events.length === 0) {
      return
    }

    const hasPending = events.some((event) => event.status === 'pending')
    if (!hasPending) {
      return
    }

    const interval = setInterval(async () => {
      try {
        const myEvents = await EventService.getMyEvents()
        const stillHasPending = myEvents.some((event) => event.status === 'pending')
        if (stillHasPending) {
          setEvents(myEvents)
        }
      } catch (err) {
        // 조용히 실패 (에러는 표시하지 않음)
        console.error('자동 새로고침 오류:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isAuthenticated, isManager, events])

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

  // 비밀번호 변경 모달 열기
  const handleOpenChangePassword = () => {
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError(null)
    setShowPasswordSuccess(false)
    setShowChangePasswordModal(true)
  }

  // 비밀번호 변경 모달 닫기
  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false)
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordError(null)
    setShowPasswordSuccess(false)
  }

  // 비밀번호 변경 제출
  const handleChangePassword = async () => {
    setPasswordError(null)

    // 입력 검증
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('모든 필드를 입력해주세요')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('새 비밀번호는 최소 6자 이상이어야 합니다')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다')
      return
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('새 비밀번호는 현재 비밀번호와 달라야 합니다')
      return
    }

    try {
      setIsLoading(true)
      await AuthService.changePassword(passwordData.currentPassword, passwordData.newPassword)
      setShowPasswordSuccess(true)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      console.error('비밀번호 변경 오류:', error)
      const errorMessage = error.message || '비밀번호 변경 중 오류가 발생했습니다'
      setPasswordError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = () => {
    // 1단계: 확인 모달 표시
    setDeleteAccountModalMessage('정말 회원탈퇴를 하시겠습니까?\n\n탈퇴 시 모든 계정 정보와 등록한 행사가 삭제되며, 복구할 수 없습니다.')
    setIsDeleteAccountConfirm(true)
    setShowDeleteAccountModal(true)
  }

  // 회원 탈퇴 확인 후 실제 탈퇴 처리
  const confirmDeleteAccount = async () => {
    try {
      setIsLoading(true)
      // 회원탈퇴 API 호출
      await AuthService.deleteAccount()

      // 로그아웃 처리 (로컬 스토리지 정리는 deleteAccount에서 이미 처리됨)
      await AuthService.logout()

      // AuthContext 상태 업데이트
      dispatch({ type: 'LOGOUT' })

      // 2단계: 성공 메시지 표시
      setDeleteAccountModalMessage('회원탈퇴가 완료되었습니다.')
      setIsDeleteAccountConfirm(false)
      setShowDeleteAccountModal(true)
    } catch (error) {
      console.error('회원탈퇴 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '회원탈퇴 중 오류가 발생했습니다'
      setDeleteAccountModalMessage(errorMessage)
      setIsDeleteAccountConfirm(false)
      setShowDeleteAccountModal(true)
    } finally {
      setIsLoading(false)
    }
  }

  // 회원 탈퇴 모달 닫기
  const handleCloseDeleteAccountModal = () => {
    setShowDeleteAccountModal(false)
    setDeleteAccountModalMessage('')
    setIsDeleteAccountConfirm(false)
    
    // 탈퇴 완료 후 홈으로 이동
    if (deleteAccountModalMessage.includes('완료되었습니다')) {
      navigate('/')
    }
  }

  // 행사 삭제 핸들러 (1단계: 확인 모달 표시)
  const handleDeleteEvent = (eventId: number, eventTitle: string) => {
    setEventToDelete({ id: eventId, title: eventTitle })
    setDeleteEventModalMessage(`정말 "${eventTitle}" 행사를 삭제하시겠습니까?`)
    setShowDeleteEventModal(true)
  }

  // 행사 삭제 확인 핸들러 (2단계: 실제 삭제)
  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return

    try {
      setDeletingEventId(eventToDelete.id)
      setShowDeleteEventModal(false) // 확인 모달 닫기
      
      await EventService.deleteEvent(eventToDelete.id)
      
      // 삭제 성공 시 행사 목록에서 제거
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDelete.id))
      
      // 성공 모달 표시
      setDeleteEventModalMessage('행사가 삭제되었습니다')
      setShowDeleteEventModal(true)
      setEventToDelete(null)
    } catch (error) {
      console.error('행사 삭제 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '행사 삭제 중 오류가 발생했습니다'
      setDeleteEventModalMessage(errorMessage)
      setShowDeleteEventModal(true)
    } finally {
      setDeletingEventId(null)
    }
  }

  // 행사 삭제 취소 핸들러
  const cancelDeleteEvent = () => {
    setShowDeleteEventModal(false)
    setEventToDelete(null)
  }

  return (
    <>
      {/* 행사 삭제 확인/결과 모달 */}
      {showDeleteEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-red-100 p-3">
                  {eventToDelete ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  )}
                </div>
              </div>
              <p className="text-center text-sm text-slate-600 mb-6">
                {deleteEventModalMessage}
              </p>
              {eventToDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={cancelDeleteEvent}
                    className="flex-1 rounded-lg bg-slate-100 py-3 font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmDeleteEvent}
                    disabled={deletingEventId !== null}
                    className="flex-1 rounded-lg bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingEventId ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteEventModal(false)}
                  className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

      <div className="space-y-16 pb-20">

      <div className="mx-auto max-w-content px-6">
        {/* 역할별 메인 섹션 */}
        <section className="space-y-8">
        
        {/* 관리자와 일반 사용자 모두 동일한 레이아웃 */}
        {isManager ? (
          <div className="space-y-6">
            {/* 등록한 행사 목록 (전체 너비) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">등록한 행사 목록</h2>
              
              {isLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-primary" />
                    <p className="mt-4 text-slate-600">행사 목록을 불러오는 중...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                    <p className="mt-4 text-red-600">{error}</p>
                  </div>
                </div>
              ) : events.length === 0 ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-slate-600">등록한 행사가 없습니다.</p>
                    <Link
                      to="/events/create"
                      className="mt-2 inline-block text-sm text-brand-primary hover:underline"
                    >
                      행사 등록하기 →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 md:grid-cols-2 ${events.length > 6 ? 'max-h-[600px] overflow-y-auto' : ''}`}>
                  {events.map((event) => {
                    const statusBadge = getStatusBadge(event.status)
                    const StatusIcon = statusBadge.icon
                    const eraserBadge = getEraserBadge(event.eraser)
                    const EraserIcon = eraserBadge?.icon

                    return (
                      <div
                        key={event.id}
                        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-primary hover:shadow-md"
                      >
                        {/* 제목과 상태 */}
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <Link
                            to={`/events/${event.id}`}
                            className="text-lg font-bold text-slate-900 hover:text-brand-primary transition-colors cursor-pointer line-clamp-1"
                          >
                            {event.title}
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div
                              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge.color}`}
                            >
                              <StatusIcon className={`h-3 w-3 ${statusBadge.iconColor}`} />
                              <span>{statusBadge.text}</span>
                            </div>
                            {eraserBadge && EraserIcon && (
                              <div
                                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${eraserBadge.color}`}
                              >
                                <EraserIcon className={`h-3 w-3 ${eraserBadge.iconColor}`} />
                                <span>{eraserBadge.text}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 정보 */}
                        <div className="space-y-1.5 text-sm text-slate-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-slate-400" />
                            <span>{event.sport}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {event.region} {event.sub_region}
                              {event.venue && ` · ${event.venue}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {formatDate(event.start_at)} ~ {formatDate(event.end_at)}
                            </span>
                          </div>
                        </div>

                        {/* 수정/삭제 버튼 - 맨 아래 오른쪽 */}
                        <div className="mt-auto flex items-center justify-end gap-2">
                          <Link
                            to={`/events/edit/${event.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary/5 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            수정
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event.id, event.title)}
                            disabled={deletingEventId === event.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingEventId === event.id ? '삭제 중...' : '삭제'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 설정 (하단) - 관리자는 전체 너비 */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">설정</h2>
              <button
                type="button"
                onClick={handleOpenChangePassword}
                className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition hover:border-brand-primary hover:shadow-md"
              >
                <div>
                  <p className="font-semibold">내 계정 관리</p>
                  <p className="mt-1 text-xs text-slate-600">
                    계정 비밀번호를 변경하거나 회원탈퇴를 할 수 있습니다.
                  </p>
                </div>
                <Key className="h-5 w-5 flex-shrink-0 text-brand-primary" />
              </button>
            </div>
          </div>
        ) : (
          /* 일반 사용자: 찜 목록을 상단에, 계정 관리를 하단에 배치 */
          <div className="space-y-6">
            {/* 찜 목록 관리 (전체 너비) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">찜 목록 관리</h2>
              
              {isLoadingFavorites ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-primary" />
                    <p className="mt-4 text-slate-600">찜 목록을 불러오는 중...</p>
                  </div>
                </div>
              ) : favoriteEvents.length === 0 ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <Heart className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-slate-600">찜한 행사가 없습니다.</p>
                    <Link
                      to="/"
                      className="mt-2 inline-block text-sm text-brand-primary hover:underline"
                    >
                      행사 둘러보기 →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 md:grid-cols-2 ${favoriteEvents.length > 6 ? 'max-h-[600px] overflow-y-auto' : ''}`}>
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
                        onClick={() => handleRemoveFavorite(event.id)}
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

            {/* 내 계정 관리 (하단) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">설정</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleOpenChangePassword}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition hover:border-brand-primary hover:shadow-md"
                >
                  <div>
                    <p className="font-semibold">내 계정 관리</p>
                    <p className="mt-1 text-xs text-slate-600">
                      계정 비밀번호를 변경하거나 회원탈퇴를 할 수 있습니다.
                    </p>
                  </div>
                  <Key className="h-5 w-5 flex-shrink-0 text-brand-primary" />
                </button>

                <button
                  type="button"
                  onClick={handleChangeInterests}
                  className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 transition hover:border-brand-primary hover:shadow-md"
                >
                  <div>
                    <p className="font-semibold">관심 종목 변경하기</p>
                    <p className="mt-1 text-xs text-slate-600">
                      관심 있는 체육 종목과 사용자 유형을 다시 선택할 수 있습니다.
                    </p>
                  </div>
                  <Tag className="h-5 w-5 flex-shrink-0 text-brand-primary" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 회원 탈퇴 모달 */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                {isDeleteAccountConfirm ? (
                  <AlertCircle className="h-10 w-10 text-red-500" />
                ) : deleteAccountModalMessage.includes('완료되었습니다') ? (
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-500" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
                {isDeleteAccountConfirm ? '회원 탈퇴 확인' : deleteAccountModalMessage.includes('완료되었습니다') ? '탈퇴 완료' : '탈퇴 실패'}
              </h3>
              <p className="text-sm text-slate-600 mb-6 text-center whitespace-pre-line">
                {deleteAccountModalMessage}
              </p>
              <div className="flex justify-center gap-3">
                {isDeleteAccountConfirm ? (
                  <>
                    <button
                      onClick={handleCloseDeleteAccountModal}
                      className="w-full rounded-lg border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={confirmDeleteAccount}
                      disabled={isLoading}
                      className="w-full rounded-lg bg-red-500 py-3 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '처리 중...' : '탈퇴'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleCloseDeleteAccountModal}
                    className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              {!showPasswordSuccess ? (
                <>
                  {/* 헤더 */}
                  <div className="mb-6 text-center">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10">
                      <Key className="h-6 w-6 text-brand-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">비밀번호 변경</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      현재 비밀번호를 입력하고 새 비밀번호를 설정하세요
                    </p>
                  </div>

                  {/* 입력 필드 */}
                  <div className="space-y-4 mb-6">
                    {/* 현재 비밀번호 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        현재 비밀번호
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="현재 비밀번호를 입력하세요"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </div>

                    {/* 새 비밀번호 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        새 비밀번호
                      </label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="새 비밀번호 (최소 6자)"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                      
                      {/* 비밀번호 강도 표시 */}
                      {passwordData.newPassword && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-600">비밀번호 강도</span>
                            <span className={`text-xs font-semibold ${
                              passwordStrength.level === 1 ? 'text-red-600' :
                              passwordStrength.level === 2 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {passwordStrength.text}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                              passwordStrength.level >= 1 ? passwordStrength.color : 'bg-slate-200'
                            }`}></div>
                            <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                              passwordStrength.level >= 2 ? passwordStrength.color : 'bg-slate-200'
                            }`}></div>
                            <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                              passwordStrength.level >= 3 ? passwordStrength.color : 'bg-slate-200'
                            }`}></div>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {passwordStrength.level === 1 && '대소문자, 숫자, 특수문자를 포함하세요'}
                            {passwordStrength.level === 2 && '더 안전한 비밀번호를 위해 다양한 문자를 사용하세요'}
                            {passwordStrength.level === 3 && '안전한 비밀번호입니다'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        새 비밀번호 확인
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="새 비밀번호를 다시 입력하세요"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </div>

                    {/* 에러 메시지 */}
                    {passwordError && (
                      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                        {passwordError}
                      </div>
                    )}
                  </div>

                  {/* 버튼 */}
                  <div className="space-y-3">
                    <button
                      onClick={handleChangePassword}
                      disabled={isLoading}
                      className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '변경 중...' : '비밀번호 변경'}
                    </button>
                    <button
                      onClick={handleCloseChangePassword}
                      disabled={isLoading}
                      className="w-full rounded-lg border border-slate-300 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>

                  {/* 구분선 */}
                  <div className="my-6 flex items-center gap-3">
                    <div className="flex-1 border-t border-slate-200"></div>
                    <span className="text-xs text-slate-500">또는</span>
                    <div className="flex-1 border-t border-slate-200"></div>
                  </div>

                  {/* 회원탈퇴 버튼 */}
                  <button
                    onClick={() => {
                      handleCloseChangePassword()
                      handleDeleteAccount()
                    }}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-red-300 bg-red-50 py-3 font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    회원탈퇴
                  </button>
                </>
              ) : (
                <>
                  {/* 성공 메시지 */}
                  <div className="text-center">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-slate-900">변경 완료</h3>
                    <p className="mb-6 text-sm text-slate-600">
                      비밀번호가 성공적으로 변경되었습니다
                    </p>
                    <button
                      onClick={handleCloseChangePassword}
                      className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
                    >
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    </>
  )
}

