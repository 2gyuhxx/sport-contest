import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'
import { EventService, type SportCategory, type SubSportCategory } from '../services/EventService'
import { Upload, Link as LinkIcon, Calendar, MapPin, Building2, Tag, ShieldAlert, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('') // 기존 이미지 URL 저장
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false) // 성공 메시지 표시 여부
  const [successModalMessage, setSuccessModalMessage] = useState('') // 성공 모달 메시지
  const [showErrorModal, setShowErrorModal] = useState(false) // 에러 모달 표시 여부
  const [errorModalMessage, setErrorModalMessage] = useState('') // 에러 모달 메시지
  
  // 컴포넌트 마운트 시 스포츠 종목 목록 가져오기
  const [sportCategories, setSportCategories] = useState<SportCategory[]>([])
  const [subSportCategories, setSubSportCategories] = useState<SubSportCategory[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  // 주소 관련 state
  const [postcode, setPostcode] = useState<string>('')
  const [fullAddress, setFullAddress] = useState<string>('')
  const [detailAddress, setDetailAddress] = useState<string>('')

  // 컴포넌트 마운트 시 대분류 스포츠 종목과 지역 목록 가져오기
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true)
        const categories = await EventService.getSportCategoriesDB()
        setSportCategories(categories)
      } catch (err) {
        console.error('데이터 로딩 오류:', err)
        setError('데이터를 불러오는데 실패했습니다')
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [])

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

          // 스포츠 카테고리 이름으로 ID 찾기
          const categories = await EventService.getSportCategoriesDB()
          const sportCategory = categories.find(cat => cat.name === event.sport)
          const sportCategoryId = sportCategory?.id || null

          // 소분류 ID 찾기 (대분류가 있을 때만)
          let subSportCategoryId = null
          if (sportCategoryId && event.sub_sport) {
            const subCategories = await EventService.getSubSportCategoriesById(sportCategoryId)
            const subCategory = subCategories.find(sub => sub.name === event.sub_sport)
            subSportCategoryId = subCategory?.id || null
          }

          setFormData({
            title: event.title || '',
            organizer: event.organizer_user_name || '',
            sport_category_id: sportCategoryId,
            sub_sport_category_id: subSportCategoryId,
            start_at: formatDate(event.start_at),
            end_at: formatDate(event.end_at),
            region: event.region || '',
            sub_region: event.sub_region || '',
            address: '',
            summary: event.description || '',
            link: event.website || '',
            image: event.image || '',
          })

          // 주소 데이터 로드
          if (event.address) {
            const formattedPostcode = String(event.address).padStart(5, '0')
            setPostcode(formattedPostcode)
          }
          if (event.venue) {
            setFullAddress(event.venue)
            setDetailAddress('') // 상세 주소는 별도 필드가 없으므로 빈 문자열로 시작
          }

          // 이미지 미리보기 설정
          if (event.image) {
            setImagePreview(event.image)
            setOriginalImageUrl(event.image) // 기존 이미지 URL 저장
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

  // sport_category 선택 시 sub_sport 목록 가져오기
  // sport_category_id 선택 시 소분류 목록 가져오기
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  useEffect(() => {
    const loadSubSportCategories = async () => {
      if (!formData.sport_category_id) {
        setSubSportCategories([])
        if (!isInitialLoad) {
          setFormData(prev => ({ ...prev, sub_sport_category_id: null }))
        }
        return
      }

      try {
        const subCategories = await EventService.getSubSportCategoriesById(formData.sport_category_id)
        setSubSportCategories(subCategories)
        // 대분류가 변경되면 소분류 초기화 (단, 초기 로드 시에는 제외)
        if (!isInitialLoad) {
          setFormData(prev => ({ ...prev, sub_sport_category_id: null }))
        } else {
          setIsInitialLoad(false)
        }
      } catch (err) {
        console.error('소분류 카테고리 로딩 오류:', err)
        setSubSportCategories([])
      }
    }
    loadSubSportCategories()
  }, [formData.sport_category_id])


  // 필드 변경 핸들러
  const handleChange = (
    field: keyof FormData,
    value: string | number | null
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

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      // 파일이 선택되지 않았을 때는 기존 이미지로 복원
      setImageFile(null)
      // 기존 이미지 URL이 있으면 복원
      if (originalImageUrl) {
        setImagePreview(originalImageUrl)
      } else if (formData.image) {
        setImagePreview(formData.image)
        setOriginalImageUrl(formData.image) // formData에서도 가져와서 저장
      } else {
        setImagePreview('')
      }
      return
    }
    

    // 파일 타입 검증 (이미지만 허용)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/tif']
    if (!allowedTypes.includes(file.type)) {
      alert('이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF, WEBP, BMP, TIFF)')
      e.target.value = ''
      // 파일 선택 실패 시에도 기존 이미지 복원
      if (originalImageUrl) {
        setImagePreview(originalImageUrl)
      } else if (formData.image) {
        setImagePreview(formData.image)
      }
      return
    }

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      alert('파일 크기는 10MB 이하여야 합니다.')
      e.target.value = ''
      // 파일 크기 초과 시에도 기존 이미지 복원
      if (originalImageUrl) {
        setImagePreview(originalImageUrl)
      } else if (formData.image) {
        setImagePreview(formData.image)
      }
      return
    }

    setImageFile(file)

    // 미리보기 생성
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 우편번호 검색
  const handlePostcodeSearch = () => {
    if (typeof window === 'undefined' || !(window as any).daum?.Postcode) {
      alert('우편번호 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요.')
      return
    }
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        const zonecode = data.zonecode || ''
        const fullAddr = data.address || ''
        let extraAddr = ''
        if (data.bname !== '') {
          extraAddr += data.bname
        }
        if (data.buildingName !== '') {
          extraAddr += extraAddr !== '' ? `, ${data.buildingName}` : data.buildingName
        }
        const fullAddress = extraAddr !== '' ? `${fullAddr} (${extraAddr})` : fullAddr

        const formattedPostcode = zonecode ? String(zonecode).padStart(5, '0') : '' // 5자리 패딩

        setPostcode(formattedPostcode)
        setFullAddress(fullAddress)
        setFormData(prev => ({
          ...prev,
          address: formattedPostcode, // 우편번호를 5자리 고정 문자열로 저장
          region: data.sido || '', // 시/도
          sub_region: data.sigungu || '', // 시/군/구
        }))
      }
    }).open()
  }

  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // 모든 필수 필드 검증 (생성/수정 모드 공통)
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
    if (!postcode) {
      newErrors.address = '주소를 검색해주세요.'
    }
    if (!formData.summary.trim()) {
      newErrors.summary = '간단 요약을 입력해주세요.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    const isValid = validateForm()
    if (!isValid) {
      return
    }

    if (!user) {
      setError('로그인이 필요합니다.')
      return
    }

    setIsLoading(true)

    try {
      if (isEditMode && eventId) {
        // 수정 모드
        let imageUrl: string | null = null

        // 이미지 파일이 있으면 업로드
        if (imageFile) {
          try {
            setIsUploading(true)
            imageUrl = await EventService.uploadFile(imageFile, parseInt(eventId, 10))
          } catch (uploadError: any) {
            console.error('[행사 수정] 이미지 업로드 실패:', uploadError)
            setIsUploading(false)
            setIsLoading(false)
            
            // 세션 만료 에러인 경우
            if (uploadError.message.includes('세션이 만료')) {
              setError(uploadError.message)
              setTimeout(() => {
                navigate('/login')
              }, 2000)
              return
            }
            
            setError(`이미지 업로드에 실패했습니다: ${uploadError.message}`)
            return
          } finally {
            setIsUploading(false)
          }
        }
        
        // 전체 주소 + 상세 주소 조합
        const combinedAddress = detailAddress.trim()
          ? `${fullAddress} ${detailAddress.trim()}`
          : fullAddress

        // 우편번호를 5자리 고정 문자열로 변환 (앞에 0 채우기)
        const formattedPostcode = postcode ? String(postcode).padStart(5, '0') : null

        // ID를 이름으로 변환
        const sportCategory = sportCategories.find(cat => cat.id === formData.sport_category_id)
        const subSportCategory = subSportCategories.find(sub => sub.id === formData.sub_sport_category_id)

        // 수정 모드: 모든 필드를 전송 (빈 문자열이어도 전송, 서버에서 기존 값으로 처리)
        const updateData = {
          title: formData.title || '',
          description: formData.summary || '',
          sport: sportCategory?.name || '',
          sub_sport: subSportCategory?.name || '',
          region: formData.region || '',
          sub_region: formData.sub_region || '',
          venue: combinedAddress || null, // 전체 주소 + 상세 주소를 venue에 저장
          address: formattedPostcode, // 우편번호를 5자리 고정 문자열로 저장
          start_at: formData.start_at || '',
          end_at: formData.end_at || '',
          website: formData.link || null,
          image: imageUrl || null,
          organizer_user_name: formData.organizer || '',
        }
        
        await EventService.updateEvent(parseInt(eventId, 10), updateData)
        // 성공 메시지 표시 (수정 모드일 때만)
        setSuccessModalMessage('행사 정보가 성공적으로 수정되었습니다. 스팸 검사 후 최종 등록됩니다. 결과는 마이페이지에서 확인하실 수 있습니다.')
        setShowSuccessMessage(true)
        setIsLoading(false) // 성공 시 로딩 상태 해제
      } else {
        // 전체 주소 + 상세 주소 조합
        const combinedAddress = detailAddress.trim()
          ? `${fullAddress} ${detailAddress.trim()}`
          : fullAddress

        // 우편번호를 5자리 고정 문자열로 변환 (앞에 0 채우기)
        const formattedPostcode = postcode ? String(postcode).padStart(5, '0') : null

        // ID를 이름으로 변환
        const sportCategory = sportCategories.find(cat => cat.id === formData.sport_category_id)
        const subSportCategory = subSportCategories.find(sub => sub.id === formData.sub_sport_category_id)

        // 생성 모드: 먼저 이미지 없이 이벤트 생성
        const createdEvent = await EventService.createEvent({
          title: formData.title,
          description: formData.summary, // 간단 요약을 description으로 사용
          sport: sportCategory?.name || '',
          sub_sport: subSportCategory?.name || '',
          region: formData.region, // 시/도 (우편번호 검색에서 자동 설정)
          sub_region: formData.sub_region, // 시/군/구 (우편번호 검색에서 자동 설정)
          venue: combinedAddress || null, // 전체 주소 + 상세 주소
          address: formattedPostcode, // 우편번호를 5자리 고정 문자열로 저장
          start_at: formData.start_at,
          end_at: formData.end_at,
          website: formData.link || null,
          image: null, // 먼저 이미지 없이 생성
          organizer_user_name: formData.organizer, // 개최사
        })

        // 이미지 파일이 있으면 업로드 후 이미지만 업데이트
        if (imageFile) {
          try {
            setIsUploading(true)
            const imageUrl = await EventService.uploadFile(imageFile, createdEvent.id)

            // 행사 이미지만 업데이트 (pending 상태 체크 없음)
            await EventService.updateEventImage(createdEvent.id, imageUrl)
          } catch (uploadError: any) {
            console.error('[행사 생성] 이미지 업로드 실패:', uploadError)
            setErrorModalMessage(`행사는 등록되었지만 이미지 업로드에 실패했습니다: ${uploadError.message}`)
            setShowErrorModal(true)
          } finally {
            setIsUploading(false)
          }
        }

        setSuccessModalMessage('행사 등록이 접수되었습니다. 스팸 검사 후 최종 등록됩니다. 결과는 마이페이지에서 확인하실 수 있습니다.')
        setShowSuccessMessage(true)
      }
    } catch (err) {
      console.error('행사 등록/수정 오류:', err)
      const errorMessage = err instanceof Error ? err.message : (isEditMode ? '행사 수정에 실패했습니다' : '행사 등록에 실패했습니다')
      
      // 스팸으로 분류된 경우 특별 처리
      if (errorMessage.includes('스팸으로 분류')) {
        setErrorModalMessage('해당 행사는 스팸으로 분류되어 등록할 수 없습니다!')
        setShowErrorModal(true)
        if (!isEditMode) {
          setTimeout(() => navigate('/'), 2000)
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
    setSubSportCategories([])
    setPostcode('')
    setFullAddress('')
    setDetailAddress('')
    setImageFile(null)
    setImagePreview('')
    setErrors({})
    setError(null)
  }

  // 성공 메시지 확인 핸들러
  const handleConfirmSuccess = () => {
    setShowSuccessMessage(false)
    if (isEditMode) {
      navigate('/my')
    } else {
      navigate('/')
    }
  }

  // 에러 모달 확인 핸들러
  const handleConfirmError = () => {
    setShowErrorModal(false)
  }

  // 권한 체크: 행사 주최자(manager=1) 또는 master(manager=2)만 행사 등록 가능
  const isOrganizer = user?.manager === 1
  const isMaster = user?.manager === 2
  
  if (!isAuthenticated || (!isOrganizer && !isMaster)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
          <p className="mb-6 text-slate-600">
            행사 등록 페이지는 행사 주최자 또는 관리자만 이용할 수 있습니다.
            {!isAuthenticated && ' 로그인 후 이용해주세요.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition hover:bg-brand-secondary"
            >
              홈으로 이동
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-brand-primary px-6 py-3 font-semibold text-brand-primary transition hover:bg-brand-primary/5"
            >
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 행사 등록/수정 성공 모달 */}
      {showSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-center text-sm text-slate-600 mb-6">
                {successModalMessage}
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

      {/* 에러 모달 */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <p className="text-center text-sm text-slate-600 mb-6">
                {errorModalMessage}
              </p>
              <button
                onClick={handleConfirmError}
                className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8 pb-16">

      {/* 폼 */}
      <section className="mx-auto max-w-3xl px-6">
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
                  onChange={(e) => handleChange('sport_category_id', e.target.value ? Number(e.target.value) : null)}
                  disabled={isLoadingData}
                  className={`w-full rounded-xl border ${
                    errors.sport_category_id ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">{isLoadingData ? '로딩 중...' : '선택해주세요'}</option>
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
                  onChange={(e) => handleChange('sub_sport_category_id', e.target.value ? Number(e.target.value) : null)}
                  disabled={!formData.sport_category_id || isLoadingData}
                  className={`w-full rounded-xl border ${
                    errors.sub_sport_category_id ? 'border-red-300' : 'border-slate-300'
                  } px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!formData.sport_category_id 
                      ? '먼저 스포츠 대분류를 선택해주세요' 
                      : isLoadingData 
                        ? '로딩 중...' 
                        : '선택해주세요'}
                  </option>
                  {subSportCategories.map((subSport) => (
                    <option key={subSport.id} value={subSport.id}>
                      {subSport.name}
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

              {/* 주소 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  주소 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postcode}
                    placeholder="우편번호"
                    readOnly
                    className={`flex-1 rounded-xl border ${
                      errors.address ? 'border-red-300' : 'border-slate-300'
                    } px-4 py-2.5 text-slate-900 bg-slate-50`}
                  />
                  <button
                    type="button"
                    onClick={handlePostcodeSearch}
                    className="rounded-xl border border-brand-primary bg-brand-primary px-6 py-2.5 font-semibold text-white transition hover:bg-brand-secondary"
                  >
                    우편번호 검색
                  </button>
                </div>
                {postcode && (
                  <input
                    type="text"
                    value={fullAddress}
                    placeholder="주소"
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 bg-slate-50"
                  />
                )}
                {postcode && (
                  <input
                    type="text"
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                    placeholder="상세 주소를 입력하세요 (예: 4층, 101호 등)"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                )}
                {errors.address && (
                  <p className="mt-1 text-xs text-red-600">{errors.address}</p>
                )}
                {postcode && (
                  <p className="mt-1 text-xs text-slate-500">
                    선택된 주소: {formData.region} {formData.sub_region}
                  </p>
                )}
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
                  포스터 이미지/파일
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isUploading || isLoading}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:bg-slate-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-secondary"
                />
                <p className="mt-1 text-xs text-slate-500">
                  이미지 파일만 업로드 가능 (JPG, PNG, GIF, WEBP, BMP, TIFF, 최대 50MB)
                </p>
                {/* 기존 이미지 정보 표시 */}
                {!imageFile && originalImageUrl && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ 기존 이미지가 등록되어 있습니다. 새 이미지를 선택하면 기존 이미지가 교체됩니다.
                  </p>
                )}
                {isUploading && (
                  <p className="mt-2 text-sm text-blue-600">파일 업로드 중...</p>
                )}
                {imagePreview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <img
                      src={imagePreview}
                      alt="포스터 미리보기"
                      className="h-48 w-full object-cover"
                      onError={() => {
                        // 이미지 로드 실패 시에도 기존 이미지 URL 복원 시도
                        if (originalImageUrl && imagePreview !== originalImageUrl) {
                          setImagePreview(originalImageUrl)
                        } else if (formData.image && imagePreview !== formData.image) {
                          setImagePreview(formData.image)
                        } else {
                          setImagePreview('')
                        }
                      }}
                    />
                  </div>
                )}
                {imageFile && !imagePreview && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      선택된 파일: <span className="font-medium">{imageFile.name}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
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

