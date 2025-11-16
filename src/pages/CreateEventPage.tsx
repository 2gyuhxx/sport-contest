import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useEventContext } from '../context/useEventContext'
import { useAuthContext } from '../context/useAuthContext'
import type { Category } from '../types/events'
import { Upload, Link as LinkIcon, Calendar, MapPin, Building2, Tag, ShieldAlert } from 'lucide-react'

type FormData = {
  title: string
  organizer: string
  category: Category | ''
  date: string
  region: string
  city: string
  address: string
  summary: string
  description: string
  link: string
  image: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'football', label: '축구' },
  { value: 'basketball', label: '농구' },
  { value: 'baseball', label: '야구' },
  { value: 'marathon', label: '마라톤' },
  { value: 'volleyball', label: '배구' },
  { value: 'esports', label: 'e스포츠' },
  { value: 'fitness', label: '피트니스' },
]

export function CreateEventPage() {
  const navigate = useNavigate()
  const { state } = useEventContext()
  const { state: authState } = useAuthContext()
  const { user, isAuthenticated } = authState
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    organizer: '',
    category: '',
    date: '',
    region: '',
    city: '',
    address: '',
    summary: '',
    description: '',
    link: '',
    image: '',
  })
  
  const [errors, setErrors] = useState<FormErrors>({})
  const [imagePreview, setImagePreview] = useState<string>('')

  // 지역 옵션 생성
  const regionOptions = useMemo(() => {
    return state.regions.map(region => ({
      value: region.id,
      label: region.name,
    }))
  }, [state.regions])

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

    if (!formData.title.trim()) {
      newErrors.title = '행사명을 입력해주세요.'
    }
    if (!formData.organizer.trim()) {
      newErrors.organizer = '개최사를 입력해주세요.'
    }
    if (!formData.category) {
      newErrors.category = '스포츠 종류를 선택해주세요.'
    }
    if (!formData.date) {
      newErrors.date = '개최 날짜를 선택해주세요.'
    }
    if (!formData.region) {
      newErrors.region = '지역을 선택해주세요.'
    }
    if (!formData.city.trim()) {
      newErrors.city = '시/군/구를 입력해주세요.'
    }
    if (!formData.summary.trim()) {
      newErrors.summary = '간단 요약을 입력해주세요.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // TODO: 실제로는 API 호출하여 서버에 저장
    const newEvent = {
      id: `event-${Date.now()}`,
      title: formData.title,
      organizer: formData.organizer,
      category: formData.category as Category,
      date: formData.date,
      region: formData.region,
      city: formData.city,
      address: formData.address,
      summary: formData.summary,
      description: formData.description,
      link: formData.link,
      image: formData.image || 'https://via.placeholder.com/400x300',
      views: 0,
    }

    console.log('새 행사 등록:', newEvent)
    alert('행사가 성공적으로 등록되었습니다!')
    navigate('/search')
  }

  // 폼 초기화
  const handleReset = () => {
    setFormData({
      title: '',
      organizer: '',
      category: '',
      date: '',
      region: '',
      city: '',
      address: '',
      summary: '',
      description: '',
      link: '',
      image: '',
    })
    setImagePreview('')
    setErrors({})
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
    <div className="space-y-8 pb-16">
      {/* 헤더 */}
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-8 text-white md:p-12">
        <div className="mx-auto max-w-3xl">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            event registration
          </span>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            행사 등록
          </h1>
          <p className="mt-3 text-white/90">
            새로운 스포츠 행사 정보를 등록하여 더 많은 사람들과 공유하세요.
          </p>
        </div>
      </section>

      {/* 폼 */}
      <section className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-8">
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

              {/* 스포츠 종류 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  스포츠 종류 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.category ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                >
                  <option value="">선택해주세요</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-xs text-red-600">{errors.category}</p>
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
              {/* 개최 날짜 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  개최 날짜 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className={`w-full rounded-xl border ${
                      errors.date ? 'border-red-300' : 'border-slate-300'
                    } py-2.5 pl-11 pr-4 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                  />
                </div>
                {errors.date && (
                  <p className="mt-1 text-xs text-red-600">{errors.date}</p>
                )}
              </div>

              {/* 지역 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  지역 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleChange('region', e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.region ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                >
                  <option value="">선택해주세요</option>
                  {regionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.region && (
                  <p className="mt-1 text-xs text-red-600">{errors.region}</p>
                )}
              </div>

              {/* 시/군/구 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  시/군/구 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="예: 강남구, 수원시"
                  className={`w-full rounded-xl border ${
                    errors.city ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20`}
                />
                {errors.city && (
                  <p className="mt-1 text-xs text-red-600">{errors.city}</p>
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

              {/* 상세 내용 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  상세 내용
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="행사에 대한 상세한 설명을 입력해주세요"
                  rows={6}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="flex-1 rounded-full bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
            >
              행사 등록
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
  )
}

