import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services/AuthService'
import { useAuthContext } from '../context/useAuthContext'
import { EventService } from '../services/EventService'
import { formatDate } from '../utils/formatDate'
import { TestTube, User, Shield, LogIn, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Eye, Calendar, MapPin, X, ExternalLink } from 'lucide-react'

// 테스트 계정 목록
const TEST_ACCOUNTS = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: '관리자',
    role: '관리자',
    description: '모든 권한, 행사 생성/수정/삭제 가능',
    color: 'bg-red-500 hover:bg-red-600',
  },
  {
    email: 'user1@test.com',
    password: 'user123',
    name: '일반사용자1',
    role: '일반 사용자',
    description: '행사 조회, 관심 종목 설정',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    email: 'user2@test.com',
    password: 'user123',
    name: '일반사용자2',
    role: '일반 사용자',
    description: '행사 조회, 관심 종목 설정',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    email: 'organizer@test.com',
    password: 'org123',
    name: '행사주최자',
    role: '행사 주최자',
    description: '행사 생성/수정/삭제 가능',
    color: 'bg-green-500 hover:bg-green-600',
  },
]

interface PendingEvent {
  id: number
  title: string
  description: string
  sport: string
  sub_sport: string | null
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  start_at: string
  end_at: string
  website: string | null
  image: string | null
  views: number
  status: 'pending' | 'approved' | 'spam'
  eraser: 'active' | 'inactive' | null
  reports_count?: number
  reports_state?: 'normal' | 'pending' | 'blocked'
  organizer_user_name: string | null
  created_at: string
  updated_at: string | null
  reports?: Array<{
    report_id?: number
    user_id: number
    events_id?: number
    event_id?: number
    report_reason: string
    created_at?: string
    user_name?: string
    user_email?: string
  }>
}

export function DevTestPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()
  
  // 테스트 계정 로그인 관련
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // 관리자 페이지 관련
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([])
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<PendingEvent | null>(null)

  // 테스트 계정 빠른 로그인
  const handleQuickLogin = async (email: string, password: string) => {
    setIsLoading(email)
    setMessage(null)

    try {
      const user = await AuthService.login({ email, password })
      dispatch({ type: 'LOGIN', payload: user })
      
      // master 또는 행사 주최자 계정인 경우 마이페이지로 이동
      if (user.manager === 2 || user.manager === 1) {
        setMessage('✅ 로그인 성공! 마이페이지로 이동합니다...')
        setTimeout(() => {
          navigate('/mypage')
        }, 1000)
      } else {
        setMessage('✅ 로그인 성공! 홈으로 이동합니다...')
        setTimeout(() => {
          navigate('/')
        }, 1000)
      }
    } catch (err) {
      setMessage(`❌ 로그인 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      setIsLoading(null)
    }
  }

  // pending 행사 목록 로드
  const loadPendingEvents = async () => {
    setIsLoadingAdmin(true)
    setAdminMessage(null)
    try {
      const events = await EventService.getPendingEvents()
      setPendingEvents(events as PendingEvent[])
    } catch (error: any) {
      console.error('pending 행사 조회 오류:', error)
      setAdminMessage({
        type: 'error',
        text: error.message || 'pending 행사 조회 중 오류가 발생했습니다.',
      })
    } finally {
      setIsLoadingAdmin(false)
    }
  }

  useEffect(() => {
    loadPendingEvents()
  }, [])

  // 행사 상태 변경
  const handleUpdateReportState = async (eventId: number, newState: 'normal' | 'blocked') => {
    setIsLoadingAdmin(true)
    setAdminMessage(null)
    try {
      await EventService.updateEventReportState(eventId, newState)
      setAdminMessage({
        type: 'success',
        text: `행사 상태가 ${newState === 'normal' ? '정상' : '차단'}으로 변경되었습니다.`,
      })
      // 목록 새로고침
      await loadPendingEvents()
    } catch (error: any) {
      console.error('행사 상태 변경 오류:', error)
      setAdminMessage({
        type: 'error',
        text: error.message || '행사 상태 변경 중 오류가 발생했습니다.',
      })
    } finally {
      setIsLoadingAdmin(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* 🧪 개발자 테스트 페이지 섹션 */}
        <div className="mb-12">
          {/* 헤더 */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
              <TestTube className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">🧪 개발자 테스트 페이지</h1>
            <p className="mt-2 text-sm text-slate-600">
              모든 기능을 테스트할 수 있는 테스트 계정으로 빠르게 로그인하세요
            </p>
          </div>

          {/* 메시지 */}
          {message && (
            <div className={`mb-6 rounded-lg p-4 text-sm ${
              message.includes('✅') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* 테스트 계정 카드들 */}
          <div className="grid gap-4 md:grid-cols-2">
            {TEST_ACCOUNTS.map((account) => (
              <div
                key={account.email}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {account.role === '관리자' || account.role === '행사 주최자' ? (
                        <Shield className="h-5 w-5 text-amber-500" />
                      ) : (
                        <User className="h-5 w-5 text-blue-500" />
                      )}
                      <h3 className="text-lg font-bold text-slate-900">{account.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{account.role}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${
                    account.role === '관리자' ? 'bg-red-500' :
                    account.role === '행사 주최자' ? 'bg-green-500' :
                    'bg-blue-500'
                  }`}>
                    {account.role === '관리자' ? 'ADMIN' :
                     account.role === '행사 주최자' ? 'ORGANIZER' :
                     'USER'}
                  </span>
                </div>

                <p className="mb-4 text-sm text-slate-600">{account.description}</p>

                <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="font-semibold text-slate-700">계정 정보</div>
                  <div className="mt-1 space-y-1 text-slate-600">
                    <div>이메일: <code className="bg-white px-1 rounded">{account.email}</code></div>
                    <div>비밀번호: <code className="bg-white px-1 rounded">{account.password}</code></div>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickLogin(account.email, account.password)}
                  disabled={isLoading !== null}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${account.color}`}
                >
                  {isLoading === account.email ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      로그인 중...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-4 w-4" />
                      빠른 로그인
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* 안내 */}
          <div className="mt-8 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-6">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
              <TestTube className="h-5 w-5" />
              테스트 계정 생성 방법
            </h3>
            <div className="space-y-2 text-sm text-amber-800">
              <p>서버에서 다음 명령어를 실행하여 테스트 계정을 생성하세요:</p>
              <code className="block rounded bg-amber-100 p-3 font-mono text-xs">
                cd ~/sport-contest/server<br />
                node scripts/createTestAccounts.js
              </code>
              <p className="mt-3 text-xs">
                💡 이 페이지는 일반 사용자에게는 보이지 않습니다. URL을 직접 입력하여 접근하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="my-12 border-t border-slate-300"></div>

        {/* 🛡️ 관리자 페이지 섹션 */}
        <div>
          {/* 헤더 */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">🛡️ 관리자 페이지</h1>
            <p className="mt-2 text-sm text-slate-600">
              신고당한 행사들을 확인하고 관리하세요
            </p>
          </div>

          {/* 관리자 메시지 */}
          {adminMessage && (
            <div className={`mb-6 rounded-lg p-4 text-sm ${
              adminMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {adminMessage.text}
            </div>
          )}

          {/* 새로고침 버튼 */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              총 <span className="font-semibold text-slate-900">{pendingEvents.length}개</span>의 신고된 행사
            </div>
            <button
              onClick={loadPendingEvents}
              disabled={isLoadingAdmin}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingAdmin ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>

          {/* 로딩 상태 */}
          {isLoadingAdmin && pendingEvents.length === 0 && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center">
                <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
                <p className="text-slate-600">로딩 중...</p>
              </div>
            </div>
          )}

          {/* 행사 목록 */}
          {!isLoadingAdmin && pendingEvents.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-900">신고된 행사가 없습니다</h3>
              <p className="text-sm text-slate-600">현재 pending 상태인 행사가 없습니다.</p>
            </div>
          )}

          {/* 행사 카드들 */}
          {pendingEvents.length > 0 && (
            <div className="space-y-4">
              {pendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md cursor-pointer"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="p-6">
                    {/* 행사 헤더 */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                            신고 {event.reports_count || 0}회
                          </span>
                        </div>
                        <p className="mb-3 text-sm text-slate-600 line-clamp-2">{event.description}</p>
                        
                        {/* 행사 정보 */}
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                          {event.start_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(event.start_at.split('T')[0])}</span>
                            </div>
                          )}
                          {event.region && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{event.region} {event.sub_region}</span>
                            </div>
                          )}
                          {event.organizer_user_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              <span>{event.organizer_user_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 행사 이미지 */}
                      {event.image && (
                        <img
                          src={event.image}
                          alt={event.title}
                          className="ml-4 h-24 w-24 rounded-lg object-cover"
                        />
                      )}
                    </div>

                    {/* 신고 내역 */}
                    {event.reports && event.reports.length > 0 && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <h4 className="text-sm font-semibold text-slate-900">신고 내역</h4>
                        </div>
                        <div className="space-y-2">
                          {event.reports.map((report, idx) => (
                            <div key={report.report_id || idx} className="rounded border border-slate-200 bg-white p-3 text-xs">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="font-semibold text-slate-700">
                                  {report.user_name || report.user_email || `사용자 ${report.user_id}`}
                                </span>
                                {report.created_at && (
                                  <span className="text-slate-500">
                                    {new Date(report.created_at).toLocaleString('ko-KR')}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600">{report.report_reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleUpdateReportState(event.id, 'normal')}
                        disabled={isLoadingAdmin}
                        className="flex-1 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="mr-2 inline h-4 w-4" />
                        정상 처리
                      </button>
                      <button
                        onClick={() => handleUpdateReportState(event.id, 'blocked')}
                        disabled={isLoadingAdmin}
                        className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="mr-2 inline h-4 w-4" />
                        차단 처리
                      </button>
                      <button
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye className="mr-2 inline h-4 w-4" />
                        상세보기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 홈으로 돌아가기 */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>

      {/* 행사 상세 모달 */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-bold text-slate-900">{selectedEvent.title}</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6">
              {/* 행사 이미지 */}
              {selectedEvent.image && (
                <div className="mb-6 overflow-hidden rounded-xl">
                  <img
                    src={selectedEvent.image}
                    alt={selectedEvent.title}
                    className="h-64 w-full object-cover"
                  />
                </div>
              )}

              {/* 행사 설명 */}
              <div className="mb-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  행사 설명
                </h3>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{selectedEvent.description}</p>
              </div>

              {/* 행사 정보 */}
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  행사 정보
                </h3>
                <dl className="grid gap-4 text-sm">
                  <div className="grid gap-1">
                    <dt className="font-semibold text-slate-600">행사 일시</dt>
                    <dd className="text-slate-900">
                      {selectedEvent.start_at && formatDate(selectedEvent.start_at.split('T')[0])}
                      {selectedEvent.end_at && ` ~ ${formatDate(selectedEvent.end_at.split('T')[0])}`}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="font-semibold text-slate-600">지역</dt>
                    <dd className="text-slate-900">
                      {selectedEvent.region} {selectedEvent.sub_region}
                    </dd>
                  </div>
                  {selectedEvent.venue && (
                    <div className="grid gap-1">
                      <dt className="font-semibold text-slate-600">장소</dt>
                      <dd className="text-slate-900">{selectedEvent.venue}</dd>
                    </div>
                  )}
                  {selectedEvent.address && (
                    <div className="grid gap-1">
                      <dt className="font-semibold text-slate-600">주소</dt>
                      <dd className="text-slate-900">{selectedEvent.address}</dd>
                    </div>
                  )}
                  {selectedEvent.organizer_user_name && (
                    <div className="grid gap-1">
                      <dt className="font-semibold text-slate-600">주최자</dt>
                      <dd className="text-slate-900">{selectedEvent.organizer_user_name}</dd>
                    </div>
                  )}
                  <div className="grid gap-1">
                    <dt className="font-semibold text-slate-600">스포츠 종목</dt>
                    <dd className="text-slate-900">
                      {selectedEvent.sub_sport || selectedEvent.sport}
                    </dd>
                  </div>
                  {selectedEvent.website && (
                    <div className="grid gap-1">
                      <dt className="font-semibold text-slate-600">웹사이트</dt>
                      <dd>
                        <a
                          href={selectedEvent.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                        >
                          <span>{selectedEvent.website}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* 신고 내역 */}
              {selectedEvent.reports && selectedEvent.reports.length > 0 && (
                <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-slate-900">
                      신고 내역 ({selectedEvent.reports_count || 0}회)
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {selectedEvent.reports.map((report, idx) => (
                      <div key={report.report_id || idx} className="rounded-lg border border-orange-200 bg-white p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-slate-700">
                            {report.user_name || report.user_email || `사용자 ${report.user_id}`}
                          </span>
                          {report.created_at && (
                            <span className="text-xs text-slate-500">
                              {new Date(report.created_at).toLocaleString('ko-KR')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{report.report_reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleUpdateReportState(selectedEvent.id, 'normal')
                    setSelectedEvent(null)
                  }}
                  disabled={isLoadingAdmin}
                  className="flex-1 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  정상 처리
                </button>
                <button
                  onClick={() => {
                    handleUpdateReportState(selectedEvent.id, 'blocked')
                    setSelectedEvent(null)
                  }}
                  disabled={isLoadingAdmin}
                  className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle className="mr-2 inline h-4 w-4" />
                  차단 처리
                </button>
                <button
                  onClick={() => navigate(`/events/${selectedEvent.id}`)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Eye className="mr-2 inline h-4 w-4" />
                  전체 페이지 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
