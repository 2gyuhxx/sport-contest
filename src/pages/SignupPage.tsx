import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, Users, Briefcase } from 'lucide-react'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import { EventService, type SportCategory as DBSportCategory } from '../services/EventService'
import type { UserRole } from '../types/auth'

// 이모지 매핑 (DB의 실제 카테고리 이름에 따라)
const EMOJI_MAP: Record<string, string> = {
  '구기·팀': '⚽',
  '라켓·볼': '🏸',
  '레저·환경': '⛺',
  '마인드': '🧘',
  '무도·격투': '🥋',
  '빙상·생활': '🏃',
  '수상·해양': '🏊',
  '정밀·기술': '🎯',
  '체력·기술': '💪',
  '기타': '🏅',
}

// 이모지가 제대로 표시되지 않을 경우 대체 텍스트
const getCategoryDisplay = (name: string): string => {
  const emoji = EMOJI_MAP[name]
  return emoji || '🏆'
}

export function SignupPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [role, setRole] = useState<UserRole | ''>('') // 사용자 역할
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]) // 선택된 카테고리 ID
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // DB에서 가져온 스포츠 카테고리
  const [sportCategories, setSportCategories] = useState<DBSportCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // 컴포넌트 마운트 시 스포츠 카테고리 로드
  useEffect(() => {
    const loadSportCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const categories = await EventService.getSportCategoriesDB()
        setSportCategories(categories)
      } catch (err) {
        console.error('스포츠 카테고리 로드 오류:', err)
        setError('스포츠 종목을 불러오는데 실패했습니다')
      } finally {
        setIsLoadingCategories(false)
      }
    }
    loadSportCategories()
  }, [])

  // 관심 종목 토글 (최대 3개만 선택 가능)
  const toggleInterest = (categoryId: number) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        // 이미 선택된 경우 제거
        return prev.filter((id) => id !== categoryId)
      } else {
        // 최대 3개까지만 선택 가능
        if (prev.length >= 3) {
          return prev
        }
        return [...prev, categoryId]
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
    if (role === 'user' && selectedCategoryIds.length === 0) {
      setError('관심 있는 체육 종목을 최소 1개 이상 선택해주세요')
      return
    }

    setIsLoading(true)

    try {
      // 선택된 카테고리 이름 배열로 변환
      const selectedCategoryNames = selectedCategoryIds
        .map(id => sportCategories.find(cat => cat.id === id)?.name)
        .filter((name): name is string => name !== undefined)

      // 회원가입 시도 (카테고리 이름을 interests로 전달)
      const user = await AuthService.signup({
        email,
        password,
        name,
        role,
        interests: role === 'user' ? selectedCategoryNames as any : undefined,
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
        selectedCategoryIds,
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
                {isLoadingCategories ? (
                  <div className="flex items-center justify-center rounded-lg border border-surface-subtle bg-surface py-8">
                    <div className="text-center">
                      <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"></div>
                      <p className="text-sm text-slate-500">종목 로딩 중...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {sportCategories.map((category) => {
                        const isSelected = selectedCategoryIds.includes(category.id)
                        const isDisabled = !isSelected && selectedCategoryIds.length >= 3
                        const emoji = getCategoryDisplay(category.name)
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => toggleInterest(category.id)}
                            disabled={isDisabled}
                            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition ${
                              isSelected
                                ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                                : isDisabled
                                  ? 'border-surface-subtle bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'
                                  : 'border-surface-subtle bg-white text-slate-700 hover:border-brand-primary/30'
                            }`}
                          >
                            <span className="text-xl" role="img" aria-label={category.name}>
                              {emoji}
                            </span>
                            <span className="font-medium">{category.name}</span>
                            {isSelected && (
                              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                                {selectedCategoryIds.indexOf(category.id) + 1}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      선택한 종목: {selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length}개` : '없음'} (최대 3개)
                      {selectedCategoryIds.length >= 3 && (
                        <span className="ml-2 text-amber-600 font-semibold">• 최대 개수에 도달했습니다</span>
                      )}
                    </p>
                  </>
                )}
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

          {/* 구분선 */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-surface-subtle"></div>
            <span className="text-xs text-slate-500">또는</span>
            <div className="flex-1 border-t border-surface-subtle"></div>
          </div>

          {/* 소셜 회원가입 버튼들 */}
          <div className="space-y-3">
            {/* Google 회원가입 버튼 */}
            <button
              type="button"
              onClick={() => {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://wherehani.com' 
                window.location.href = `${apiBaseUrl}/auth/google`
              }}
              className="w-full flex items-center justify-center gap-3 rounded-lg border-2 border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 회원가입
            </button>

            {/* 카카오 회원가입 버튼 */}
            <button
              type="button"
              onClick={() => {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://wherehani.com'
                window.location.href = `${apiBaseUrl}/auth/kakao`
              }}
              className="w-full flex items-center justify-center gap-3 rounded-lg border-2 border-yellow-300 bg-[#FEE500] px-4 py-3 font-semibold text-slate-900 transition hover:bg-[#FDD835]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3C6.48 3 2 7.48 2 13c0 3.54 2.19 6.53 5.29 7.79L6.5 22.5l2.71-1.21C10.5 21.84 11.22 22 12 22c5.52 0 10-4.48 10-10S17.52 3 12 3z"
                  fill="#3C1E1E"
                />
              </svg>
              카카오로 회원가입
            </button>
          </div>

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

