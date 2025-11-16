import { useState, useEffect } from 'react'
import { useAuthContext } from '../context/useAuthContext'
import { EventService } from '../services/EventService'
import { Link } from 'react-router-dom'
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
  ArrowLeft
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
  created_at: string
  updated_at: string | null
}

export function MyPage() {
  const { state } = useAuthContext()
  const { user, isAuthenticated } = state
  const [events, setEvents] = useState<MyEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMyEvents = async () => {
      if (!isAuthenticated) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const myEvents = await EventService.getMyEvents()
        setEvents(myEvents)
        setError(null)
      } catch (err) {
        console.error('내 행사 목록 로딩 오류:', err)
        const errorMessage = err instanceof Error ? err.message : '행사 목록을 불러오는데 실패했습니다'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadMyEvents()
    
    // pending 상태의 행사가 있으면 3초마다 자동 새로고침
    const interval = setInterval(async () => {
      try {
        const myEvents = await EventService.getMyEvents()
        const hasPending = myEvents.some(event => event.status === 'pending')
        if (hasPending) {
          setEvents(myEvents)
        }
      } catch (err) {
        // 조용히 실패 (에러는 표시하지 않음)
        console.error('자동 새로고침 오류:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

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

  return (
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
                {user?.name}님의 등록한 행사 목록입니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 행사 목록 */}
      <section className="mx-auto max-w-3xl">
        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
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

              return (
                <div
                  key={event.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* 제목과 상태 */}
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <h3 className="text-xl font-bold text-slate-900">{event.title}</h3>
                        <div
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.color}`}
                        >
                          <StatusIcon className={`h-3.5 w-3.5 ${statusBadge.iconColor}`} />
                          <span>{statusBadge.text}</span>
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
      </section>
    </div>
  )
}

