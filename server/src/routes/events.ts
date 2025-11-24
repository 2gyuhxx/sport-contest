import express from 'express'
import pool from '../config/database.js'
import { EventModel, EventRow } from '../models/Event.js'
import { UserModel } from '../models/User.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import { checkSpamAsync } from '../utils/spamCheckerAsync.js'

const router = express.Router()

/**
 * 종료 날짜 포맷팅: 시간이 없거나 00:00:00이면 23:59:59로 설정
 */
const formatEndAt = (dateStr: string): string => {
  if (!dateStr) return dateStr
  
  // 이미 시간이 포함되어 있는지 확인
  const hasTime = dateStr.includes(' ') || dateStr.includes('T')
  
  if (!hasTime) {
    // 날짜만 있으면 23:59:59 추가
    return `${dateStr} 23:59:59`
  }
  
  // 시간이 포함되어 있으면
  // 00:00:00을 23:59:59로 변경
  if (dateStr.includes(' 00:00:00') || dateStr.endsWith('T00:00:00')) {
    return dateStr.replace(/ 00:00:00$/, ' 23:59:59').replace(/T00:00:00$/, 'T23:59:59')
  }
  
  // 이미 다른 시간이 있으면 그대로 반환
  return dateStr
}

/**
 * Date 객체를 MySQL datetime 형식 문자열로 변환 (YYYY-MM-DD HH:MM:SS)
 * 타임존 문제를 해결하기 위해 로컬 시간을 사용
 */
const formatDateForResponse = (date: Date | string | null): string | null => {
  if (!date) return null
  
  if (date instanceof Date) {
    // 로컬 시간을 사용하여 YYYY-MM-DD HH:MM:SS 형식으로 변환
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  
  // 이미 문자열인 경우 그대로 반환 (ISO 형식이면 변환)
  if (typeof date === 'string') {
    // ISO 형식 (YYYY-MM-DDTHH:mm:ss.sssZ)인 경우
    if (date.includes('T')) {
      const [datePart, timePart] = date.split('T')
      const timeOnly = timePart.split('.')[0].split('Z')[0]
      return `${datePart} ${timeOnly}`
    }
    // 이미 YYYY-MM-DD HH:MM:SS 형식인 경우
    return date
  }
  
  return String(date)
}

/**
 * 행사 생성
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, description, sport, sub_sport, region, sub_region, venue, address, start_at, end_at, website, image, organizer_user_name } = req.body

    console.log('[행사 생성 API] 요청 데이터:', {
      title,
      description,
      sport,
      sub_sport,
      region,
      sub_region,
      venue,
      address,
      start_at,
      end_at,
      website,
      image,
      organizer_user_name
    })

    // 입력 검증
    if (!title || !description || !sport || !sub_sport || !region || !sub_region || !start_at || !end_at || !organizer_user_name) {
      return res.status(400).json({ error: '모든 필수 필드를 입력해주세요' })
    }

    // 날짜 유효성 검사
    if (start_at > end_at) {
      return res.status(400).json({ error: '시작 날짜는 종료 날짜보다 이전이어야 합니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 중복 제목 검사
    const [existingEvents] = await pool.execute(
      'SELECT id FROM events WHERE title = ?',
      [title]
    )
    if (Array.isArray(existingEvents) && existingEvents.length > 0) {
      return res.status(400).json({ error: '이미 등록된 행사명입니다. 다른 이름을 사용해주세요.' })
    }

    // 우편번호를 5자리 고정 문자열로 변환 (앞에 0 채우기)
    const formattedAddress = address 
      ? String(address).padStart(5, '0') 
      : null

    // 종료일 포맷팅: 시간이 없거나 00:00:00이면 23:59:59로 설정
    const formattedEndAt = formatEndAt(end_at)

    console.log('[행사 생성 API] EventModel.create 호출:', {
      organizerUserId: req.userId,
      title,
      description,
      sport,
      subSport: sub_sport || null,
      region,
      subRegion: sub_region,
      venue: venue || null,
      address: formattedAddress,
      startAt: start_at,
      endAt: formattedEndAt,
      website: website || null,
      image: image || null,
      organizerUserName: organizer_user_name,
      status: 'pending'
    })

    // 즉시 DB에 저장 (status는 'pending' - 스팸 체크 중)
    const event = await EventModel.create(
      req.userId,
      title,
      description,
      sport,
      sub_sport || null,
      region,
      sub_region,
      venue || null,
      formattedAddress,
      start_at,
      formattedEndAt,
      website || null,
      image || null,
      organizer_user_name,
      'pending' // 초기 상태는 판정 중
    )

    console.log('[행사 생성 API] 생성된 이벤트:', {
      id: event.id,
      sub_sport: event.sub_sport,
      address: event.address,
      image: event.image
    })

    // 비동기로 스팸 체크 수행 (사용자는 기다리지 않음)
    checkSpamAsync(event.id, title, description).catch((error) => {
      console.error('비동기 스팸 체크 오류:', error)
    })

    // 응답 데이터
    const eventData = {
      id: event.id,
      organizer_user_id: event.organizer_user_id,
      organizer_user_name: event.organizer_user_name,
      title: event.title,
      description: event.description,
      sport: event.sport,
      sub_sport: event.sub_sport,
      region: event.region,
      sub_region: event.sub_region,
      venue: event.venue,
      address: event.address,
      start_at: event.start_at,
      end_at: event.end_at,
      website: event.website,
      image: event.image,
      status: event.status,
      created_at: event.created_at,
    }

    res.status(201).json({
      event: eventData,
    })
  } catch (error: any) {
    console.error('행사 생성 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
    })

    // MySQL 연결 오류
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({ error: '데이터베이스 연결에 실패했습니다' })
    }

    // 테이블이 없는 경우
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ error: '데이터베이스 테이블이 없습니다' })
    }

    // 더 자세한 오류 메시지 반환 (개발 환경)
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '행사 생성 중 오류가 발생했습니다'
      : error.message || '행사 생성 중 오류가 발생했습니다'

    res.status(500).json({
      error: errorMessage,
      code: error.code,
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    })
  }
})

/**
 * 모든 행사 가져오기
 */
router.get('/', async (req, res) => {
  try {
    const events = await EventModel.findAll()
    
    // Date 객체를 문자열로 변환하여 타임존 문제 해결
    const formattedEvents = events.map(event => ({
      ...event,
      start_at: formatDateForResponse(event.start_at),
      end_at: formatDateForResponse(event.end_at),
      created_at: formatDateForResponse(event.created_at),
      updated_at: formatDateForResponse(event.updated_at),
    }))
    
    res.json({ events: formattedEvents })
  } catch (error: any) {
    console.error('행사 목록 조회 오류:', error)
    res.status(500).json({ error: '행사 목록 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 현재 사용자가 등록한 행사 목록 가져오기
 * /:id 라우트보다 먼저 정의해야 함
 */
router.get('/my/events', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 사용자 역할 확인
    const user = await UserModel.findById(req.userId)
    
    let events: EventRow[]
    
    // manager = 2 (개발자/master): 모든 행사 목록 반환
    if (user && user.manager === 2) {
      events = await EventModel.findAllForAdmin()
    } else {
      // manager = 1 (행사 주최자) 또는 manager = 0 (일반 사용자): 자신이 등록한 행사만 반환
      events = await EventModel.findByOrganizerId(req.userId)
    }

    // Date 객체를 문자열로 변환하여 타임존 문제 해결
    const formattedEvents = events.map(event => ({
      ...event,
      start_at: formatDateForResponse(event.start_at),
      end_at: formatDateForResponse(event.end_at),
      created_at: formatDateForResponse(event.created_at),
      updated_at: formatDateForResponse(event.updated_at),
    }))

    res.json({ events: formattedEvents })
  } catch (error: any) {
    console.error('내 행사 목록 조회 오류:', error)
    res.status(500).json({ error: '행사 목록 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 행사 수정
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 기존 행사 데이터 가져오기
    const existingEvent = await EventModel.findById(eventId)
    if (!existingEvent) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 권한 확인 (행사 주최자 또는 master만 수정 가능)
    const currentUser = await UserModel.findById(req.userId!)
    if (!currentUser) {
      console.log('[행사 수정 권한 거부] 사용자를 찾을 수 없음', { userId: req.userId })
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }
    
    // 타입 안전성을 위해 명시적으로 숫자로 변환
    const userId = Number(req.userId)
    const organizerUserId = Number(existingEvent.organizer_user_id)
    const managerValue = Number(currentUser.manager)
    
    const isMaster = managerValue === 2 // manager = 2: master/개발자
    const isOrganizer = managerValue === 1 // manager = 1: 행사 주최자
    
    console.log('[행사 수정 권한 체크]', {
      eventId,
      eventTitle: existingEvent.title,
      userId,
      organizerUserId,
      isMaster,
      isOrganizer,
      managerValue,
      managerType: typeof currentUser.manager,
      userIdType: typeof userId,
      organizerUserIdType: typeof organizerUserId,
      currentUserExists: !!currentUser,
      userIdMatch: userId === organizerUserId,
      strictEqual: userId === organizerUserId,
      looseEqual: userId == organizerUserId,
    })
    
    // master는 모든 행사 수정 가능, 행사 주최자는 자신이 등록한 행사만 수정 가능
    const isOwner = organizerUserId === userId
    
    if (!isOwner && !isMaster) {
      console.log('[행사 수정 권한 거부]', { 
        eventId,
        eventTitle: existingEvent.title,
        isOwner, 
        isMaster,
        isOrganizer,
        userId, 
        organizerUserId,
        managerValue,
        reason: !isOwner ? `소유자가 아님 (userId: ${userId}, organizerUserId: ${organizerUserId})` : '',
        reason2: !isMaster ? `master가 아님 (manager: ${managerValue})` : ''
      })
      return res.status(403).json({ error: '행사를 수정할 권한이 없습니다' })
    }
    
    console.log('[행사 수정 권한 허용]', { isOwner, isMaster, userId, organizerUserId, managerValue })

    // 스팸 판정 중인 행사는 수정 불가 (master는 제외)
    if (existingEvent.status === 'pending' && !isMaster) {
      return res.status(403).json({ error: '스팸 판정 중인 행사는 수정할 수 없습니다' })
    }

    // 신고 pending 상태인 행사는 수정 불가 (master는 제외)
    if (existingEvent.reports_state === 'pending' && !isMaster) {
      return res.status(403).json({ error: '신고 처리 중인 행사는 수정할 수 없습니다' })
    }

    // blocked된 행사는 수정 불가 (master는 제외)
    if (existingEvent.reports_state === 'blocked' && !isMaster) {
      return res.status(403).json({ error: '차단 처리된 행사는 수정할 수 없습니다' })
    }

    const { title, description, sport, sub_sport, region, sub_region, venue, address, start_at, end_at, website, image, organizer_user_name } = req.body

    console.log('[행사 수정 API] 요청 데이터:', { 
      eventId, 
      title, 
      description, 
      sport,
      sub_sport,
      region, 
      sub_region,
      address,
      start_at, 
      end_at,
      website,
      image,
      organizer_user_name 
    })

    // 날짜 포맷팅 함수
    const formatDate = (date: Date): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // 헬퍼 함수: 값이 유효한지 확인 (undefined, null, 빈 문자열이면 false)
    const hasValue = (value: any): boolean => {
      if (value === undefined || value === null) return false
      if (typeof value !== 'string') return false
      return value.trim().length > 0
    }

    // 날짜 정규화 함수
    const normalizeDateString = (dateString: string): string => {
      if (!dateString || typeof dateString !== 'string') return dateString
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
        return dateString.trim()
      }
      try {
        const date = new Date(dateString)
        if (!isNaN(date.getTime())) {
          return formatDate(date)
        }
      } catch (e) {
        console.error('[행사 수정 API] 날짜 변환 오류:', e, dateString)
      }
      return dateString.trim()
    }

    // 부분 업데이트: 클라이언트에서 보낸 값이 있으면 사용하고, 없으면(undefined/null/빈 문자열) 기존 값 사용
    const finalTitle = hasValue(title) ? String(title).trim() : existingEvent.title
    const finalDescription = hasValue(description) ? String(description).trim() : existingEvent.description
    const finalSport = hasValue(sport) ? String(sport).trim() : existingEvent.sport
    const finalSubSport = hasValue(sub_sport) ? String(sub_sport).trim() : (existingEvent.sub_sport || null)
    const finalRegion = hasValue(region) ? String(region).trim() : existingEvent.region
    const finalSubRegion = hasValue(sub_region) ? String(sub_region).trim() : existingEvent.sub_region
    const finalVenue = venue !== undefined ? (venue || null) : existingEvent.venue
    const finalAddress = address !== undefined
      ? (address ? String(address).padStart(5, '0') : null)
      : (existingEvent.address ? String(existingEvent.address).padStart(5, '0') : null)
    const finalStartAt = hasValue(start_at) ? normalizeDateString(start_at) : formatDate(existingEvent.start_at)
    const finalEndAtRaw = hasValue(end_at) ? normalizeDateString(end_at) : formatDate(existingEvent.end_at)
    // 종료일 포맷팅: 시간이 없거나 00:00:00이면 23:59:59로 설정
    const finalEndAt = formatEndAt(finalEndAtRaw)
    const finalWebsite = website !== undefined ? (website || null) : existingEvent.website
    // 이미지 처리: undefined면 기존 이미지 유지, null이나 빈 문자열이면 null로 설정, 값이 있으면 그대로 사용
    const finalImage = image !== undefined 
      ? (image && typeof image === 'string' && image.trim() ? image.trim() : null)
      : (existingEvent.image || null)
    const finalOrganizerName = hasValue(organizer_user_name) ? String(organizer_user_name).trim() : (existingEvent.organizer_user_name || '')

    console.log('[행사 수정 API] 최종 업데이트 데이터:', { 
      finalTitle, 
      finalDescription, 
      finalSport,
      finalSubSport,
      finalRegion, 
      finalSubRegion,
      finalVenue,
      finalAddress,
      finalStartAt, 
      finalEndAt,
      finalWebsite,
      finalImage,
      finalOrganizerName 
    })

    // 날짜 유효성 검사
    if (finalStartAt > finalEndAt) {
      return res.status(400).json({ error: '시작 날짜는 종료 날짜보다 이전이어야 합니다' })
    }

    // 중복 제목 검사 (자기 자신은 제외)
    const [existingEvents] = await pool.execute(
      'SELECT id FROM events WHERE title = ? AND id != ?',
      [finalTitle, eventId]
    )
    if (Array.isArray(existingEvents) && existingEvents.length > 0) {
      return res.status(400).json({ error: '이미 등록된 행사명입니다. 다른 이름을 사용해주세요.' })
    }

    // 행사 업데이트
    const event = await EventModel.update(
      eventId,
      req.userId,
      finalTitle,
      finalDescription,
      finalSport,
      finalSubSport,
      finalRegion,
      finalSubRegion,
      finalVenue,
      finalAddress,
      finalStartAt,
      finalEndAt,
      finalWebsite,
      finalImage,
      finalOrganizerName
    )

    // 수정 시 스팸 체크 재수행 (최종 값 사용)
    checkSpamAsync(event.id, finalTitle, finalDescription).catch((error) => {
      console.error('비동기 스팸 체크 오류:', error)
    })

    // 응답 데이터
    const eventData = {
      id: event.id,
      organizer_user_id: event.organizer_user_id,
      organizer_user_name: event.organizer_user_name,
      title: event.title,
      description: event.description,
      sport: event.sport,
      sub_sport: event.sub_sport,
      region: event.region,
      sub_region: event.sub_region,
      venue: event.venue,
      address: event.address,
      start_at: event.start_at,
      end_at: event.end_at,
      website: event.website,
      image: event.image,
      status: event.status,
      created_at: event.created_at,
      updated_at: event.updated_at,
    }

    res.json({ event: eventData })
  } catch (error: any) {
    console.error('행사 수정 오류:', error)
    
    if (error.message === '행사를 찾을 수 없습니다' || error.message === '행사를 수정할 권한이 없습니다') {
      return res.status(403).json({ error: error.message })
    }

    res.status(500).json({ 
      error: error.message || '행사 수정 중 오류가 발생했습니다'
    })
  }
})

/**
 * 행사 이미지만 업데이트 (pending 상태 체크 없음 - 행사 생성 직후 이미지 업로드용)
 * 보안: 행사 생성 후 10분 이내에만 사용 가능 (악용 방지)
 */
router.patch('/:id/image', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    const { image } = req.body
    if (!image) {
      return res.status(400).json({ error: '이미지 URL이 필요합니다' })
    }

    // 기존 행사 데이터 가져오기
    const existingEvent = await EventModel.findById(eventId)
    if (!existingEvent) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 권한 확인 (행사 주최자 또는 master만 이미지 수정 가능)
    const currentUser = await UserModel.findById(req.userId!)
    const isMaster = currentUser?.manager === 2 // manager = 2: master/개발자
    
    // 타입 안전성을 위해 명시적으로 숫자로 변환
    const userId = Number(req.userId)
    const organizerUserId = Number(existingEvent.organizer_user_id)
    
    console.log('[이미지 수정 권한 체크]', {
      userId,
      organizerUserId,
      isMaster,
      manager: currentUser?.manager
    })
    
    // master는 모든 행사 이미지 수정 가능, 행사 주최자는 자신이 등록한 행사만 수정 가능
    const isOwner = organizerUserId === userId
    if (!isOwner && !isMaster) {
      console.log('[이미지 수정 권한 거부]', { isOwner, isMaster, userId, organizerUserId })
      return res.status(403).json({ error: '행사를 수정할 권한이 없습니다' })
    }
    
    console.log('[이미지 수정 권한 허용]', { isOwner, isMaster, userId, organizerUserId })

    // 보안: 행사 생성 후 10분 이내에만 이미지 업로드 허용 (악용 방지)
    // 단, master는 시간 제한 없이 업로드 가능
    if (!isMaster) {
      const createdDate = new Date(existingEvent.created_at)
      const now = new Date()
      const minutesSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60)
      
      if (minutesSinceCreation > 10) {
        // 10분이 지난 경우 일반 수정 API 사용 필요
        return res.status(403).json({ 
          error: '행사 생성 후 일정 시간이 지나 일반 수정 방법을 사용해주세요' 
        })
      }
    }

    // 이미지만 업데이트 (pending 상태 체크 없음)
    await pool.execute(
      'UPDATE events SET image = ?, updated_at = NOW() WHERE id = ?',
      [image, eventId]
    )

    // 업데이트된 행사 반환
    const updatedEvent = await EventModel.findById(eventId)
    if (!updatedEvent) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    res.json({ 
      success: true,
      event: {
        id: updatedEvent.id,
        image: updatedEvent.image,
      }
    })
  } catch (error: any) {
    console.error('행사 이미지 업데이트 오류:', error)
    res.status(500).json({ 
      error: error.message || '행사 이미지 업데이트 중 오류가 발생했습니다'
    })
  }
})

/**
 * 특정 행사 가져오기
 */
router.get('/:id', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    res.json({ event })
  } catch (error: any) {
    console.error('행사 조회 오류:', error)
    res.status(500).json({ error: '행사 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 행사 조회수 증가 (명시적 API)
 */
router.post('/:id/view', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    // 행사 존재 확인
    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 조회수 증가
    await EventModel.incrementViews(eventId)

    // 업데이트된 행사 정보 가져오기
    const updatedEvent = await EventModel.findById(eventId)

    res.json({ 
      success: true, 
      message: '조회수가 증가되었습니다',
      views: updatedEvent?.views || 0
    })
  } catch (error: any) {
    console.error('조회수 증가 오류:', error)
    res.status(500).json({ error: '조회수 증가 중 오류가 발생했습니다' })
  }
})

/**
 * 행사 삭제
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 행사 존재 확인
    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 권한 확인 (행사 주최자 또는 master만 삭제 가능)
    const currentUser = await UserModel.findById(req.userId!)
    const isMaster = currentUser?.manager === 2 // manager = 2: master/개발자
    
    // 타입 안전성을 위해 명시적으로 숫자로 변환
    const userId = Number(req.userId)
    const organizerUserId = Number(event.organizer_user_id)
    
    console.log('[행사 삭제 권한 체크]', {
      userId,
      organizerUserId,
      isMaster,
      manager: currentUser?.manager
    })
    
    // master는 모든 행사 삭제 가능, 행사 주최자는 자신이 등록한 행사만 삭제 가능
    const isOwner = organizerUserId === userId
    if (!isOwner && !isMaster) {
      console.log('[행사 삭제 권한 거부]', { isOwner, isMaster, userId, organizerUserId })
      return res.status(403).json({ error: '행사를 삭제할 권한이 없습니다' })
    }
    
    console.log('[행사 삭제 권한 허용]', { isOwner, isMaster, userId, organizerUserId })

    // 스팸 판정 중인 행사는 삭제 불가 (master는 제외)
    if (event.status === 'pending' && !isMaster) {
      return res.status(403).json({ error: '스팸 판정 중인 행사는 삭제할 수 없습니다' })
    }

    // 신고 pending 상태인 행사는 삭제 불가 (master는 제외, blocked는 삭제 가능)
    if (event.reports_state === 'pending' && !isMaster) {
      return res.status(403).json({ error: '신고 처리 중인 행사는 삭제할 수 없습니다' })
    }

    // 행사 삭제
    await EventModel.delete(eventId)

    res.json({ 
      success: true, 
      message: '행사가 삭제되었습니다'
    })
  } catch (error: any) {
    console.error('행사 삭제 오류:', error)
    
    if (error.message === '행사를 찾을 수 없습니다' || error.message === '행사를 삭제할 권한이 없습니다') {
      return res.status(403).json({ error: error.message })
    }

    res.status(500).json({ 
      error: error.message || '행사 삭제 중 오류가 발생했습니다'
    })
  }
})

/**
 * 행사 신고
 */
router.post('/:id/report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    const { report_reason } = req.body
    if (!report_reason || !report_reason.trim()) {
      return res.status(400).json({ error: '신고 사유를 입력해주세요' })
    }

    // 행사 존재 확인
    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 이미 신고했는지 확인 (실제 테이블 컬럼명: report_id, event_id 사용)
    const [existingReports] = await pool.execute(
      'SELECT report_id FROM events_reports WHERE user_id = ? AND event_id = ?',
      [req.userId, eventId]
    )
    if (Array.isArray(existingReports) && existingReports.length > 0) {
      return res.status(400).json({ error: '이미 신고한 행사입니다' })
    }

    // events_reports 테이블에 신고 저장 (실제 테이블 컬럼명: event_id 사용)
    await pool.execute(
      'INSERT INTO events_reports (user_id, event_id, report_reason) VALUES (?, ?, ?)',
      [req.userId, eventId, report_reason.trim()]
    )

    // events 테이블의 reports_count 증가
    await pool.execute(
      'UPDATE events SET reports_count = COALESCE(reports_count, 0) + 1 WHERE id = ?',
      [eventId]
    )

    // 업데이트된 행사 정보 가져오기
    const [updatedRows] = await pool.execute(
      'SELECT reports_count, reports_state FROM events WHERE id = ?',
      [eventId]
    )
    const updatedEvent = Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] as { reports_count: number; reports_state: string } : null

    if (!updatedEvent) {
      return res.status(500).json({ error: '행사 정보를 가져올 수 없습니다' })
    }

    // reports_count가 4 이상이면 reports_state를 'pending'으로 변경 (4회 신고 시 웹에서 사라짐)
    if (updatedEvent.reports_count >= 4) {
      await pool.execute(
        'UPDATE events SET reports_state = ? WHERE id = ?',
        ['pending', eventId]
      )
      updatedEvent.reports_state = 'pending'
    }

    // 최종 업데이트된 정보 가져오기
    const [finalRows] = await pool.execute(
      'SELECT reports_count, reports_state FROM events WHERE id = ?',
      [eventId]
    )
    const finalEvent = Array.isArray(finalRows) && finalRows.length > 0 ? finalRows[0] as { reports_count: number; reports_state: string } : updatedEvent

    // 신고 정보 가져오기 (실제 테이블 컬럼명: report_id, event_id 사용)
    const [reportRows] = await pool.execute(
      'SELECT report_id, user_id, event_id, report_reason, created_at FROM events_reports WHERE user_id = ? AND event_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.userId, eventId]
    )
    const report = Array.isArray(reportRows) && reportRows.length > 0 ? reportRows[0] : null

    res.json({
      report: report ? {
        id: (report as any).report_id,
        user_id: (report as any).user_id,
        events_id: (report as any).event_id,
        report_reason: (report as any).report_reason,
        created_at: (report as any).created_at,
      } : null,
      event: {
        reports_count: finalEvent.reports_count,
        reports_state: finalEvent.reports_state || 'normal',
      },
    })
  } catch (error: any) {
    console.error('행사 신고 오류:', error)
    console.error('에러 상세:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
    })
    
    // 더 자세한 오류 메시지 반환 (개발 환경)
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '행사 신고 중 오류가 발생했습니다'
      : error.message || error.sqlMessage || '행사 신고 중 오류가 발생했습니다'
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV !== 'production' ? {
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      } : undefined,
    })
  }
})

/**
 * 행사 신고 취소
 */
router.delete('/:id/report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 행사 존재 확인
    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // 신고 기록 확인 (실제 테이블 컬럼명: report_id, event_id 사용)
    const [existingReports] = await pool.execute(
      'SELECT report_id FROM events_reports WHERE user_id = ? AND event_id = ?',
      [req.userId, eventId]
    )
    if (!Array.isArray(existingReports) || existingReports.length === 0) {
      return res.status(404).json({ error: '신고 기록을 찾을 수 없습니다' })
    }

    // events_reports 테이블에서 신고 삭제 (실제 테이블 컬럼명: event_id 사용)
    await pool.execute(
      'DELETE FROM events_reports WHERE user_id = ? AND event_id = ?',
      [req.userId, eventId]
    )

    // events 테이블의 reports_count 감소
    await pool.execute(
      'UPDATE events SET reports_count = GREATEST(COALESCE(reports_count, 0) - 1, 0) WHERE id = ?',
      [eventId]
    )

    // 업데이트된 행사 정보 가져오기
    const [updatedRows] = await pool.execute(
      'SELECT reports_count, reports_state FROM events WHERE id = ?',
      [eventId]
    )
    const updatedEvent = Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] as { reports_count: number; reports_state: string } : null

    if (!updatedEvent) {
      return res.status(500).json({ error: '행사 정보를 가져올 수 없습니다' })
    }

    // reports_count가 4 미만이면 reports_state를 'normal'로 변경 (4회 미만이면 다시 웹에 나타남)
    if (updatedEvent.reports_count < 4) {
      await pool.execute(
        'UPDATE events SET reports_state = ? WHERE id = ?',
        ['normal', eventId]
      )
      updatedEvent.reports_state = 'normal'
    }

    res.json({
      event: {
        reports_count: updatedEvent.reports_count,
        reports_state: updatedEvent.reports_state || 'normal',
      },
    })
  } catch (error: any) {
    console.error('행사 신고 취소 오류:', error)
    console.error('에러 상세:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    })
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '행사 신고 취소 중 오류가 발생했습니다'
      : error.message || error.sqlMessage || '행사 신고 취소 중 오류가 발생했습니다'
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV !== 'production' ? {
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      } : undefined,
    })
  }
})

/**
 * 사용자가 해당 행사를 신고했는지 확인
 */
router.get('/:id/report/check', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 신고 기록 확인 (실제 테이블 컬럼명: report_id, event_id 사용)
    const [reportRows] = await pool.execute(
      'SELECT report_id, user_id, event_id, report_reason, created_at FROM events_reports WHERE user_id = ? AND event_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.userId, eventId]
    )
    const report = Array.isArray(reportRows) && reportRows.length > 0 ? reportRows[0] : null

    res.json({
      report: report ? {
        id: (report as any).report_id,
        user_id: (report as any).user_id,
        events_id: (report as any).event_id,
        report_reason: (report as any).report_reason,
        created_at: (report as any).created_at,
      } : null,
    })
  } catch (error: any) {
    console.error('신고 확인 오류:', error)
    console.error('에러 상세:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    })
    
    const errorMessage = process.env.NODE_ENV === 'production'
      ? '신고 확인 중 오류가 발생했습니다'
      : error.message || error.sqlMessage || '신고 확인 중 오류가 발생했습니다'
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV !== 'production' ? {
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      } : undefined,
    })
  }
})

/**
 * 관리자: pending 상태인 행사 목록 조회
 */
router.get('/admin/pending', async (req, res) => {
  try {
    const [rows] = await pool.execute<EventRow[]>(
      `SELECT e.*, 
              COUNT(er.report_id) as reports_count
       FROM events e
       LEFT JOIN events_reports er ON e.id = er.event_id
       WHERE e.reports_state = 'pending'
       GROUP BY e.id
       ORDER BY e.created_at DESC`
    )

    // 신고 정보도 함께 가져오기
    const eventsWithReports = await Promise.all(
      rows.map(async (event) => {
        const [reportRows] = await pool.execute<any[]>(
          `SELECT er.*, u.name as user_name, u.email as user_email
           FROM events_reports er
           LEFT JOIN users u ON er.user_id = u.id
           WHERE er.event_id = ?
           ORDER BY er.created_at DESC`,
          [event.id]
        )
        return {
          ...event,
          reports: reportRows,
        }
      })
    )

    res.json({ events: eventsWithReports })
  } catch (error: any) {
    console.error('관리자 pending 행사 조회 오류:', error)
    res.status(500).json({ 
      error: 'pending 행사 조회 중 오류가 발생했습니다',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    })
  }
})

/**
 * 관리자: 행사의 reports_state 변경
 */
router.patch('/admin/:id/report-state', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10)
    const { reports_state } = req.body

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: '유효하지 않은 행사 ID입니다' })
    }

    if (!reports_state || !['normal', 'pending', 'blocked'].includes(reports_state)) {
      return res.status(400).json({ error: '유효하지 않은 reports_state 값입니다. normal, pending, blocked 중 하나여야 합니다' })
    }

    // 행사 존재 확인
    const event = await EventModel.findById(eventId)
    if (!event) {
      return res.status(404).json({ error: '행사를 찾을 수 없습니다' })
    }

    // reports_state가 'normal'로 변경될 때, 해당 행사의 모든 신고 기록 삭제
    if (reports_state === 'normal') {
      // events_reports 테이블에서 해당 event_id의 모든 신고 기록 삭제
      await pool.execute(
        'DELETE FROM events_reports WHERE event_id = ?',
        [eventId]
      )
      
      // events 테이블의 reports_count를 0으로 리셋
      await pool.execute(
        `UPDATE events 
         SET reports_state = ?, reports_count = 0, updated_at = NOW()
         WHERE id = ?`,
        [reports_state, eventId]
      )
    } else {
      // 'normal'이 아닌 경우에는 reports_state만 업데이트
      await pool.execute(
        `UPDATE events 
         SET reports_state = ?, updated_at = NOW()
         WHERE id = ?`,
        [reports_state, eventId]
      )
    }

    // 업데이트된 행사 정보 반환
    const updatedEvent = await EventModel.findById(eventId)

    res.json({ 
      message: '행사 상태가 변경되었습니다',
      event: updatedEvent,
    })
  } catch (error: any) {
    console.error('관리자 reports_state 변경 오류:', error)
    res.status(500).json({ 
      error: '행사 상태 변경 중 오류가 발생했습니다',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    })
  }
})

export default router

