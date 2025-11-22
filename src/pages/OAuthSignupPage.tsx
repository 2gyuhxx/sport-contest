import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus, Users, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import { EventService, type SportCategory as DBSportCategory } from '../services/EventService'
import { categoryMap } from '../services/EventService'
import type { UserRole } from '../types/auth'
import type { Category } from '../types/events'

// 이모지 매핑 (DB의 실제 카테고리 이름에 따라)
const EMOJI_MAP: Record<string, string> = {
  '구기·팀': '⚽',
  '라켓·볼': '🏸',
  '레저·환경': '⛺',
  '마인드': '🧘',
  '무도·격투': '🥋',
  '빙상·설원': '⛷️',
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

export function OAuthSignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const isEditInterestsMode = mode === 'interests' // 마이페이지에서 온 경우
  const { state, dispatch } = useAuthContext()
  const { user } = state

  const [role, setRole] = useState<UserRole | ''>(
    isEditInterestsMode ? (user?.manager ? 'organizer' : 'user') : ''
  ) // 사용자 역할
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]) // 선택된 카테고리 ID
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false) // 성공 메시지 표시 여부
  
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
      } finally {
        setIsLoadingCategories(false)
      }
    }
    loadSportCategories()
  }, [])

  // 관심종목 수정 모드일 때 현재 사용자의 관심종목 불러오기
  useEffect(() => {
    if (isEditInterestsMode && user?.interests && user.interests.length > 0 && sportCategories.length > 0) {
      // 사용자의 관심 종목(영어 카테고리 ID)을 DB 카테고리 ID로 변환
      const userInterests = user.interests as Category[]
      const categoryIds = userInterests
        .map(categoryId => {
          // 영어 카테고리 ID를 한글 이름으로 변환
          const koreanName = Object.entries(categoryMap).find(([_, id]) => id === categoryId)?.[0]
          // 한글 이름으로 DB 카테고리 찾기
          return sportCategories.find(cat => cat.name === koreanName)?.id
        })
        .filter((id): id is number => id !== undefined)
      setSelectedCategoryIds(categoryIds)
    }
  }, [isEditInterestsMode, user, sportCategories])

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

    // 신규 가입 모드일 때만 역할 선택 검증
    if (!isEditInterestsMode) {
      if (!role) {
        setError('사용자 유형을 선택해주세요')
        return
      }
    }

    // 관심종목 수정 모드에서는 현재 사용자의 역할 사용
    const currentRole = isEditInterestsMode ? (user?.manager ? 'organizer' : 'user') : role
    const isUser = currentRole === 'user'

    // 일반 사용자인 경우 관심 종목 필수
    if (isUser && selectedCategoryIds.length === 0) {
      setError('관심 있는 체육 종목을 최소 1개 이상 선택해주세요')
      return
    }

    setIsLoading(true)

    try {
      // 사용자 정보 업데이트
      // 관심종목 수정 모드일 때는 manager 필드는 변경하지 않음 (현재 역할 유지)
      const updateData: { manager?: boolean; sports?: string | null } = {}
      
      if (!isEditInterestsMode) {
        // 신규 가입 모드일 때만 manager 업데이트
        updateData.manager = role === 'organizer'
      }
      
      // 일반 사용자인 경우에만 관심종목 업데이트
      if (isUser) {
        // 선택된 카테고리 ID를 한글 이름으로 변환
        const selectedCategoryNames = selectedCategoryIds
          .map(id => sportCategories.find(cat => cat.id === id)?.name)
          .filter((name): name is string => name !== undefined)
        updateData.sports = selectedCategoryNames.length > 0 ? selectedCategoryNames.join(',') : null
      }
      
      const updatedUser = await AuthService.updateUserInfo(updateData)

      // Context에 사용자 정보 업데이트
      dispatch({ type: 'LOGIN', payload: updatedUser })

      // 관심종목 수정 모드일 때만 성공 메시지 표시
      if (isEditInterestsMode) {
        setShowSuccessMessage(true)
      } else {
        // 신규 가입 모드일 때는 홈으로 이동
        navigate('/')
      }
    } catch (err) {
      console.error('사용자 정보 업데이트 오류:', err)
      const errorMessage = err instanceof Error ? err.message : '사용자 정보 업데이트에 실패했습니다'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmSuccess = () => {
    setShowSuccessMessage(false)
    navigate('/mypage')
  }

  return (
    <>
      {/* 관심종목 변경 완료 모달 */}
      {showSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">종목이 변경되었습니다</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                관심 종목이 성공적으로 변경되었습니다.
              </p>
              <button
                onClick={handleConfirmSuccess}
                className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-300px)] items-center justify-center py-8">
        <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isEditInterestsMode ? '관심 종목 수정' : '추가 정보 입력'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isEditInterestsMode
              ? '관심 있는 체육 종목을 다시 선택할 수 있습니다'
              : '소셜 로그인을 완료했습니다. 추가 정보를 입력해주세요'}
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

            {/* 사용자 유형 선택 - 신규 가입일 때만 표시 */}
            {!isEditInterestsMode && (
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
                    <span
                      className={`text-sm font-semibold ${
                        role === 'user' ? 'text-brand-primary' : 'text-slate-700'
                      }`}
                    >
                      일반 사용자
                    </span>
                    <span className="text-xs text-slate-500">행사 탐색 및 참여</span>
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
                      className={`h-8 w-8 ${
                        role === 'organizer' ? 'text-brand-primary' : 'text-slate-400'
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        role === 'organizer' ? 'text-brand-primary' : 'text-slate-700'
                      }`}
                    >
                      행사 관리자
                    </span>
                    <span className="text-xs text-slate-500">행사 등록 및 관리</span>
                  </button>
                </div>
              </div>
            )}

            {/* 관심 종목 선택 (일반 사용자인 경우만 또는 관심종목 수정 모드인 경우) */}
            {(role === 'user' || (isEditInterestsMode && !user?.manager)) && (
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

            {/* 완료 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? '처리 중...' : '완료'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  )
}

