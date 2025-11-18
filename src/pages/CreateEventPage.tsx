import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'
import { EventService, type SportCategory, type SubSportCategory } from '../services/EventService'
import { Upload, Link as LinkIcon, Calendar, MapPin, Building2, Tag, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react'

type FormData = {
  title: string
  organizer: string
  sport_category_id: number | null
  sub_sport_category_id: number | null
  start_at: string
  end_at: string
  region: string
  sub_region: string
  address: string
  summary: string
  link: string
  image: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

export function CreateEventPage() {
  const navigate = useNavigate()
  const { eventId } = useParams<{ eventId?: string }>()
  const isEditMode = !!eventId
  const { state: authState } = useAuthContext()
  const { user, isAuthenticated } = authState
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    organizer: '',
    sport_category_id: null,
    sub_sport_category_id: null,
    start_at: '',
    end_at: '',
    region: '',
    sub_region: '',
    address: '',
    summary: '',
    link: '',
    image: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false) // 성공 메시지 표시 여부
  
  // DB에서 가져온 데이터
  const [sportCategories, setSportCategories] = useState<SportCategory[]>([])
  const [subSportCategories, setSubSportCategories] = useState<SubSportCategory[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [subRegions, setSubRegions] = useState<string[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  // 컴포넌트 마운트 시 대분류 스포츠 종목과 지역 목록 가져오기
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true)
        const [categories, regionsData] = await Promise.all([
          EventService.getSportCategoriesDB(),
          EventService.getRegions(),
        ])
        setSportCategories(categories)
        setRegions(regionsData)
      } catch (err) {
        console.error('데이터 로딩 오류:', err)
        setError('데이터를 불러오는데 실패했습니다')
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [])

  // sport_category_id 선택 시 소분류 목록 가져오기
  useEffect(() => {
    const loadSubSportCategories = async () => {
      if (!formData.sport_category_id) {
        setSubSportCategories([])
        setFormData(prev => ({ ...prev, sub_sport_category_id: null }))
        return
      }

      try {
        const subCategories = await EventService.getSubSportCategories(formData.sport_category_id)
        setSubSportCategories(subCategories)
        // 대분류가 변경되면 소분류 초기화
        setFormData(prev => ({ ...prev, sub_sport_category_id: null }))
      } catch (err) {
        console.error('소분류 카테고리 로딩 오류:', err)
        setSubSportCategories([])
      }
    }
    loadSubSportCategories()
  }, [formData.sport_category_id])

  // 수정 모드일 때 기존 행사 데이터 로드
  useEffect(() => {
    if (isEditMode && eventId) {
      const loadEventData = async () => {
        try {
          setIsLoadingData(true)
          const event = await EventService.getEventById(parseInt(eventId, 10))
          
          // 날짜 포맷팅 (YYYY-MM-DD 형식으로 변환)
          const formatDate = (dateString: string) => {
            const date = new Date(dateString)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }

          setFormData({
            title: event.title || '',
            organizer: event.organizer_user_name || '',
            sport_category_id: null, // DB에서 로드된 데이터를 기반으로 나중에 설정
            sub_sport_category_id: null,
            start_at: formatDate(event.start_at),
            end_at: formatDate(event.end_at),
            region: event.region || '',
            sub_region: event.sub_region || '',
            address: event.venue || '',
            summary: event.description || '',
            link: event.website || '',
            image: '',
          })

          if (event.region) {
            const subRegionsData = await EventService.getSubRegions(event.region)
            setSubRegions(subRegionsData)
          }
        } catch (err) {
          console.error('행사 데이터 로딩 오류:', err)
          setError('행사 데이터를 불러오는데 실패했습니다')
        } finally {
          setIsLoadingData(false)
        }
      }
      loadEventData()
    }
  }, [isEditMode, eventId])

  // region 선택 시 sub_region 목록 가져오기
  useEffect(() => {
    const loadSubRegions = async () => {
      if (!formData.region) {
        setSubRegions([])
        setFormData(prev => ({ ...prev, sub_region: '' }))
        return
      }

      try {
        const subRegionsData = await EventService.getSubRegions(formData.region)
        setSubRegions(subRegionsData)
        // region이 변경되면 sub_region 초기화
        setFormData(prev => ({ ...prev, sub_region: '' }))
      } catch (err) {
        console.error('시군구 목록 로딩 오류:', err)
        setSubRegions([])
      }
    }
    loadSubRegions()
  }, [formData.region])

  // 필드 변경 핸들러
  const handleChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 에러 제거
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // 이미지 URL 변경 시 미리보기 업데이트
  const handleImageChange = (url: string) => {
    handleChange('image', url)
    setImagePreview(url)
  }

  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // 수정 모드일 때는 필수 검증 완화 (기존 값이 있으면 필수 아님)
    if (isEditMode) {
      // 수정 모드: 날짜 유효성 검사만 수행
      if (formData.start_at && formData.end_at && formData.start_at > formData.end_at) {
        newErrors.end_at = '종료 날짜는 시작 날짜보다 이후여야 합니다.'
      }
    } else {
      // 생성 모드: 모든 필수 필드 검증
      if (!formData.title.trim()) {
        newErrors.title = '행사명을 입력해주세요.'
      }
      if (!formData.organizer.trim()) {
        newErrors.organizer = '개최사를 입력해주세요.'
      }
      if (!formData.sport_category_id) {
        newErrors.sport_category_id = '스포츠 대분류를 선택해주세요.'
      }
      if (!formData.sub_sport_category_id) {
        newErrors.sub_sport_category_id = '스포츠 소분류를 선택해주세요.'
      }
      if (!formData.start_at) {
        newErrors.start_at = '시작 날짜를 선택해주세요.'
      }
      if (!formData.end_at) {
        newErrors.end_at = '종료 날짜를 선택해주세요.'
      }
      if (formData.start_at && formData.end_at && formData.start_at > formData.end_at) {
        newErrors.end_at = '종료 날짜는 시작 날짜보다 이후여야 합니다.'
      }
      if (!formData.region) {
        newErrors.region = '지역을 선택해주세요.'
      }
      if (!formData.sub_region) {
        newErrors.sub_region = '시/군/구를 선택해주세요.'
      }
      if (!formData.summary.trim()) {
        newErrors.summary = '간단 요약을 입력해주세요.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[행사 수정] handleSubmit 호출됨', { isEditMode, eventId })
    setError(null)
    
    const isValid = validateForm()
    console.log('[행사 수정] 폼 검증 결과:', isValid, errors)
    if (!isValid) {
      console.log('[행사 수정] 폼 검증 실패:', errors)
      return
    }

    if (!user) {
      setError('로그인이 필요합니다.')
      console.log('[행사 수정] 사용자 없음')
      return
    }

    setIsLoading(true)
    console.log('[행사 수정] 로딩 시작')

    try {
      // 선택된 소분류의 이름을 찾기
      const selectedSubCategory = subSportCategories.find(
        (sub) => sub.id === formData.sub_sport_category_id
      )
      
      if (!selectedSubCategory) {
        setError('스포츠 소분류를 찾을 수 없습니다.')
        setIsLoading(false)
        return
      }

      if (isEditMode && eventId) {
        // 수정 모드
        console.log('[행사 수정] 수정 시작:', { eventId, formData })
        
        const updateData = {
          title: formData.title || '',
          description: formData.summary || '',
          sport: selectedSubCategory.name, // 소분류 이름을 sport로 저장
          region: formData.region || '',
          sub_region: formData.sub_region || '',
          venue: formData.address || null,
          start_at: formData.start_at || '',
          end_at: formData.end_at || '',
          website: formData.link || null,
          organizer_user_name: formData.organizer || '',
        }
        
        console.log('[행사 수정] API 호출 데이터:', updateData)
        const result = await EventService.updateEvent(parseInt(eventId, 10), updateData)
        console.log('[행사 수정] API 응답:', result)

        console.log('[행사 수정] 수정 완료, 성공 메시지 표시')
        setShowSuccessMessage(true)
        setIsLoading(false)
      } else {
        // 생성 모드
        await EventService.createEvent({
          title: formData.title,
          description: formData.summary,
          sport: selectedSubCategory.name, // 소분류 이름을 sport로 저장
          region: formData.region,
          sub_region: formData.sub_region,
          venue: formData.address || null,
          start_at: formData.start_at,
          end_at: formData.end_at,
          website: formData.link || null,
          organizer_user_name: formData.organizer,
        })

        // 등록 성공 모달 표시
        const confirmed = window.confirm(
          `✅ 행사 등록이 완료되었습니다!\n\n` +
          `📋 행사명: ${formData.title}\n` +
          `🔍 현재 상태: 스팸 검사 중\n\n` +
          `스팸 검사는 자동으로 진행되며, 완료되면 행사 목록에 표시됩니다.\n` +
          `(일반적으로 10초 이내 완료)\n\n` +
          `마이페이지에서 등록 상태를 확인하시겠습니까?`
        )
        
        if (confirmed) {
          navigate('/my')
        } else {
          navigate('/')
        }
      }
    } catch (err) {
      console.error('행사 등록/수정 오류:', err)
      const errorMessage = err instanceof Error ? err.message : (isEditMode ? '행사 수정에 실패했습니다' : '행사 등록에 실패했습니다')
      
      // 스팸으로 분류된 경우 특별 처리
      if (errorMessage.includes('스팸으로 분류')) {
        alert('해당 행사는 스팸으로 분류되어 등록할 수 없습니다!')
        if (!isEditMode) {
          navigate('/')
        }
        return
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  // 폼 초기화
  const handleReset = () => {
    setFormData({
      title: '',
      organizer: '',
      sport: '',
      start_at: '',
      end_at: '',
      region: '',
      sub_region: '',
      address: '',
      summary: '',
      link: '',
      image: '',
    })
    setImagePreview('')
    setErrors({})
    setError(null)
    setSubRegions([])
  }

  // 성공 메시지 확인 핸들러
  const handleConfirmSuccess = () => {
    setShowSuccessMessage(false)
    navigate('/my')
  }

  // 권한 체크: 행사 관리자만 접근 가능
  if (!isAuthenticated || user?.role !== 'organizer') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
          <p className="mb-6 text-slate-600">
            행사 등록 페이지는 행사 관리자만 이용할 수 있습니다.
            {!isAuthenticated && ' 로그인 후 이용해주세요.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
            >
              홈으로 이동
            </Link>
            {!isAuthenticated && (
              <Link
                to="/signup"
                className="rounded-lg border border-brand-primary px-6 py-3 font-semibold text-brand-primary transition hover:bg-brand-primary/5"
              >
                행사 관리자로 회원가입
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 권한 체크: 행사 관리자만 접근 가능 (manager가 true일 때만)
  if (!isAuthenticated || !user?.manager) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
          <p className="mb-6 text-slate-600">
            행사 등록 페이지는 행사 관리자만 이용할 수 있습니다.
            {!isAuthenticated && ' 로그인 후 이용해주세요.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
            >
              홈으로 이동
            </Link>
            {!isAuthenticated && (
              <Link
                to="/signup"
                className="rounded-lg border border-brand-primary px-6 py-3 font-semibold text-brand-primary transition hover:bg-brand-primary/5"
              >
                행사 관리자로 회원가입
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 행사 수정 완료 모달 */}
      {showSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">행사가 수정되었습니다</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                행사 정보가 성공적으로 수정되었습니다. 스팸 검사 후 최종 등록됩니다. 결과는 마이페이지에서 확인하실 수 있습니다.
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

      <div className="space-y-8 pb-16">
        {/* 헤더 */}
        <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-white md:p-12">
        <div className="mx-auto max-w-3xl">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            event registration
          </span>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            {isEditMode ? '행사 수정' : '행사 등록'}
          </h1>
          <p className="mt-3 text-white/90">
            {isEditMode 
              ? '등록한 행사 정보를 수정할 수 있습니다. 수정 후 스팸 검사를 다시 진행합니다.'
              : '새로운 스포츠 행사 정보를 등록하여 더 많은 사람들과 공유하세요.'}
          </p>
        </div>
      </section>

      {/* 폼 */}
      <section className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {/* 기본 정보 섹션 */}
          <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Tag className="h-5 w-5 text-brand-primary" />
              기본 정보
            </h2>
            
            <div className="space-y-5">
              {/* 행사명 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  행사명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="예: 2025 서울 마라톤 대회"
                  className={`w-full rounded-xl border ${
                    errors.title ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-red-600">{errors.title}</p>
                )}
              </div>

              {/* 개최사 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  개최사 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.organizer}
                    onChange={(e) => handleChange('organizer', e.target.value)}
                    placeholder="예: 서울시청, 대한체육회"
                    className={`w-full rounded-xl border ${
                      errors.organizer ? 'border-red-300' : 'border-slate-300'
                    } py-2.5 pl-11 pr-4 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                  />
                </div>
                {errors.organizer && (
                  <p className="mt-1 text-xs text-red-600">{errors.organizer}</p>
                )}
              </div>

              {/* 스포츠 대분류 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  스포츠 대분류 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sport_category_id || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    setFormData(prev => ({ ...prev, sport_category_id: value }))
                    if (errors.sport_category_id) {
                      setErrors(prev => {
                        const next = { ...prev }
                        delete next.sport_category_id
                        return next
                      })
                    }
                  }}
                  disabled={isLoadingData}
                  className={`w-full rounded-xl border ${
                    errors.sport_category_id ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">{isLoadingData ? '로딩 중...' : '대분류를 선택해주세요'}</option>
                  {sportCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.sport_category_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.sport_category_id}</p>
                )}
              </div>

              {/* 스포츠 소분류 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  스포츠 소분류 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sub_sport_category_id || ''}
                  onChange={(e) => {
                    const value = e.target.value ? parseInt(e.target.value) : null
                    setFormData(prev => ({ ...prev, sub_sport_category_id: value }))
                    if (errors.sub_sport_category_id) {
                      setErrors(prev => {
                        const next = { ...prev }
                        delete next.sub_sport_category_id
                        return next
                      })
                    }
                  }}
                  disabled={!formData.sport_category_id || subSportCategories.length === 0}
                  className={`w-full rounded-xl border ${
                    errors.sub_sport_category_id ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!formData.sport_category_id 
                      ? '먼저 대분류를 선택해주세요' 
                      : subSportCategories.length === 0 
                      ? '소분류가 없습니다' 
                      : '소분류를 선택해주세요'}
                  </option>
                  {subSportCategories.map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </option>
                  ))}
                </select>
                {errors.sub_sport_category_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.sub_sport_category_id}</p>
                )}
              </div>
            </div>
          </div>

          {/* 일시/장소 섹션 */}
          <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <MapPin className="h-5 w-5 text-brand-primary" />
              일시 및 장소
            </h2>
            
            <div className="space-y-5">
              {/* 시작 날짜 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  시작 날짜 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={formData.start_at}
                    onChange={(e) => handleChange('start_at', e.target.value)}
                    className={`w-full rounded-xl border ${
                      errors.start_at ? 'border-red-300' : 'border-slate-300'
                    } py-2.5 pl-11 pr-4 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                  />
                </div>
                {errors.start_at && (
                  <p className="mt-1 text-xs text-red-600">{errors.start_at}</p>
                )}
              </div>

              {/* 종료 날짜 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  종료 날짜 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={formData.end_at}
                    onChange={(e) => handleChange('end_at', e.target.value)}
                    min={formData.start_at || undefined}
                    className={`w-full rounded-xl border ${
                      errors.end_at ? 'border-red-300' : 'border-slate-300'
                    } py-2.5 pl-11 pr-4 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                  />
                </div>
                {errors.end_at && (
                  <p className="mt-1 text-xs text-red-600">{errors.end_at}</p>
                )}
              </div>

              {/* 광역자치단체 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  광역자치단체 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleChange('region', e.target.value)}
                  disabled={isLoadingData}
                  className={`w-full rounded-xl border ${
                    errors.region ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">{isLoadingData ? '로딩 중...' : '선택해주세요'}</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
                {errors.region && (
                  <p className="mt-1 text-xs text-red-600">{errors.region}</p>
                )}
              </div>

              {/* 기초자치단체 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  기초자치단체 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sub_region}
                  onChange={(e) => handleChange('sub_region', e.target.value)}
                  disabled={!formData.region || isLoadingData}
                  className={`w-full rounded-xl border ${
                    errors.sub_region ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!formData.region 
                      ? '먼저 지역을 선택해주세요' 
                      : isLoadingData 
                        ? '로딩 중...' 
                        : '선택해주세요'}
                  </option>
                  {subRegions.map((subRegion) => (
                    <option key={subRegion} value={subRegion}>
                      {subRegion}
                    </option>
                  ))}
                </select>
                {errors.sub_region && (
                  <p className="mt-1 text-xs text-red-600">{errors.sub_region}</p>
                )}
              </div>

              {/* 상세 주소 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="예: 테헤란로 123"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>
          </div>

          {/* 콘텐츠 섹션 */}
          <div className="rounded-3xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-900">
              <Upload className="h-5 w-5 text-brand-primary" />
              콘텐츠
            </h2>
            
            <div className="space-y-5">
              {/* 포스터 이미지 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  포스터 이미지 URL
                </label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => handleImageChange(e.target.value)}
                  placeholder="https://example.com/poster.jpg"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
                {imagePreview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="포스터 미리보기"
                      className="h-48 w-full object-cover"
                      onError={() => setImagePreview('')}
                    />
                  </div>
                )}
              </div>

              {/* 관련 링크 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  관련 링크
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => handleChange('link', e.target.value)}
                    placeholder="https://example.com/event-info"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-4 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>

              {/* 간단 요약 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  간단 요약 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => handleChange('summary', e.target.value)}
                  placeholder="행사를 한 줄로 요약해주세요 (최대 100자)"
                  rows={2}
                  maxLength={100}
                  className={`w-full rounded-xl border ${
                    errors.summary ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                />
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  {errors.summary ? (
                    <span className="text-red-600">{errors.summary}</span>
                  ) : (
                    <span></span>
                  )}
                  <span>{formData.summary.length}/100</span>
                </div>
              </div>

            </div>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isLoading || isLoadingData}
              onClick={(e) => {
                console.log('[행사 수정] 버튼 클릭됨', { isLoading, isLoadingData, isEditMode, eventId })
                if (!e.isDefaultPrevented()) {
                  // handleSubmit이 form의 onSubmit으로 호출되므로 여기서는 로그만
                }
              }}
              className="flex-1 rounded-full bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading || isLoadingData ? (isEditMode ? '수정 중...' : '등록 중...') : (isEditMode ? '행사 수정' : '행사 등록')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </button>
          </div>
        </form>
      </section>
      </div>
    </>
  )
}

