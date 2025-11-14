import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, Users, Briefcase } from 'lucide-react'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import type { UserRole, SportCategory } from '../types/auth'

// 스포츠 카테고리 정보
const SPORT_CATEGORIES: { value: SportCategory; label: string; emoji: string }[] = [
  { value: 'football', label: '축구', emoji: '⚽' },
  { value: 'basketball', label: '농구', emoji: '🏀' },
  { value: 'cycling', label: '사이클', emoji: '🚴' },
  { value: 'baseball', label: '야구', emoji: '⚾' },
  { value: 'track', label: '육상', emoji: '🏃' },
  { value: 'swimming', label: '수영', emoji: '🏊' },
  { value: 'tabletennis', label: '탁구', emoji: '🏓' },
  { value: 'badminton', label: '배드민턴', emoji: '🏸' },
  { value: 'taekwondo', label: '태권도', emoji: '🥋' },
]

export function SignupPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [role, setRole] = useState<UserRole | ''>('') // 사용자 역할
  const [interests, setInterests] = useState<SportCategory[]>([]) // 관심 종목
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 관심 종목 토글 (최대 3개만 선택 가능)
  const toggleInterest = (category: SportCategory) => {
    setInterests((prev) => {
      if (prev.includes(category)) {
        // 이미 선택된 경우 제거
        return prev.filter((c) => c !== category)
      } else {
        // 최대 3개까지만 선택 가능
        if (prev.length >= 3) {
          return prev
        }
        return [...prev, category]
      }
    })
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // 역할 선택 검증
    if (!role) {
      setError('사용자 유형을 선택해주세요')
      return
    }

    // 비밀번호 확인 검증
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    // 일반 사용자인 경우 관심 종목 필수
    if (role === 'user' && interests.length === 0) {
      setError('관심 있는 체육 종목을 최소 1개 이상 선택해주세요')
      return
    }

    setIsLoading(true)

    try {
      // 회원가입 시도
      const user = await AuthService.signup({
        email,
        password,
        name,
        role,
        interests: role === 'user' ? interests : undefined,
      })

      // Context에 사용자 정보 저장 (자동 로그인)
      dispatch({ type: 'LOGIN', payload: user })

      // 홈으로 이동
      navigate('/')
    } catch (err) {
      console.error('회원가입 오류:', err)
      const errorMessage = err instanceof Error ? err.message : '회원가입에 실패했습니다'
      setError(errorMessage)
      console.error('오류 상세:', {
        error: err,
        message: errorMessage,
        email,
        name,
        role,
        interests,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 비밀번호 강도 체크
  const passwordStrength = password.length >= 8 ? 'strong' : password.length >= 6 ? 'medium' : 'weak'
  const passwordMatch = password && passwordConfirm && password === passwordConfirm

  return (
    <div className="flex min-h-[calc(100vh-300px)] items-center justify-center py-8">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">회원가입</h1>
          <p className="mt-2 text-sm text-slate-600">
            지역 스포츠 행사를 쉽게 탐색하세요
          </p>
        </div>

        {/* 회원가입 폼 */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 사용자 유형 선택 */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                가입 유형 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* 일반 사용자 */}
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    role === 'user'
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-surface-subtle bg-white hover:border-brand-primary/30'
                  }`}
                >
                  <Users
                    className={`h-8 w-8 ${role === 'user' ? 'text-brand-primary' : 'text-slate-400'}`}
                  />
                  <div className="text-center">
                    <div
                      className={`text-sm font-semibold ${role === 'user' ? 'text-brand-primary' : 'text-slate-700'}`}
                    >
                      일반 사용자
                    </div>
                    <div className="mt-1 text-xs text-slate-500">행사 검색 및 참여</div>
                  </div>
                </button>

                {/* 행사 관리자 */}
                <button
                  type="button"
                  onClick={() => setRole('organizer')}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    role === 'organizer'
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-surface-subtle bg-white hover:border-brand-primary/30'
                  }`}
                >
                  <Briefcase
                    className={`h-8 w-8 ${role === 'organizer' ? 'text-brand-primary' : 'text-slate-400'}`}
                  />
                  <div className="text-center">
                    <div
                      className={`text-sm font-semibold ${role === 'organizer' ? 'text-brand-primary' : 'text-slate-700'}`}
                    >
                      행사 관리자
                    </div>
                    <div className="mt-1 text-xs text-slate-500">행사 등록 및 관리</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 관심 종목 선택 (일반 사용자인 경우만) */}
            {role === 'user' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  관심 있는 체육 종목 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SPORT_CATEGORIES.map((sport) => {
                    const isSelected = interests.includes(sport.value)
                    const isDisabled = !isSelected && interests.length >= 3
                    return (
                      <button
                        key={sport.value}
                        type="button"
                        onClick={() => toggleInterest(sport.value)}
                        disabled={isDisabled}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition ${
                          isSelected
                            ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                            : isDisabled
                              ? 'border-surface-subtle bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'
                              : 'border-surface-subtle bg-white text-slate-700 hover:border-brand-primary/30'
                        }`}
                      >
                        <span className="text-lg">{sport.emoji}</span>
                        <span className="font-medium">{sport.label}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs font-semibold text-brand-primary">
                            {interests.indexOf(sport.value) + 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  선택한 종목: {interests.length > 0 ? `${interests.length}개` : '없음'} (최대 3개)
                  {interests.length >= 3 && (
                    <span className="ml-2 text-amber-600 font-semibold">• 최대 개수에 도달했습니다</span>
                  )}
                </p>
              </div>
            )}

            {/* 이름 */}
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                이름
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  minLength={2}
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">최소 2자 이상 입력해주세요</p>
            </div>

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">유효한 이메일 형식이어야 합니다</p>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              {/* 비밀번호 강도 표시 */}
              {password && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex flex-1 gap-1">
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        passwordStrength === 'weak'
                          ? 'bg-red-400'
                          : passwordStrength === 'medium'
                            ? 'bg-yellow-400'
                            : 'bg-green-400'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        passwordStrength === 'medium'
                          ? 'bg-yellow-400'
                          : passwordStrength === 'strong'
                            ? 'bg-green-400'
                            : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        passwordStrength === 'strong' ? 'bg-green-400' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {passwordStrength === 'weak' && '약함'}
                    {passwordStrength === 'medium' && '보통'}
                    {passwordStrength === 'strong' && '강함'}
                  </span>
                </div>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                최소 6자 이상 (보안을 위해 8자 이상 권장)
              </p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label
                htmlFor="passwordConfirm"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
                {passwordMatch && (
                  <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500" />
                )}
              </div>
            </div>

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-6 text-center text-sm text-slate-600">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-semibold text-brand-primary hover:underline">
              로그인
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}

