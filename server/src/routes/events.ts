import express from 'express'
import pool from '../config/database.js'
import { EventModel } from '../models/Event.js'
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
    res.json({ events })
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

    const events = await EventModel.findByOrganizerId(req.userId)
    res.json({ events })
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

    // 권한 확인
    if (existingEvent.organizer_user_id !== req.userId) {
      return res.status(403).json({ error: '행사를 수정할 권한이 없습니다' })
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
    const finalImage = image !== undefined ? (image && image.trim() ? image.trim() : null) : (existingEvent.image || null)
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

    // 권한 확인 (행사 주최자만 삭제 가능)
    if (event.organizer_user_id !== req.userId) {
      return res.status(403).json({ error: '행사를 삭제할 권한이 없습니다' })
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

export default router

