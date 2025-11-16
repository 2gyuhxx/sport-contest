import express from 'express'
import pool from '../config/database.js'
import { EventModel } from '../models/Event.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'
import { checkSpamAsync } from '../utils/spamCheckerAsync.js'

const router = express.Router()

/**
 * 행사 생성
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { title, description, sport, region, sub_region, venue, start_at, end_at, website, organizer_user_name } = req.body

    // 입력 검증
    if (!title || !description || !sport || !region || !sub_region || !start_at || !end_at || !organizer_user_name) {
      return res.status(400).json({ error: '모든 필수 필드를 입력해주세요' })
    }

    // 날짜 유효성 검사
    if (start_at > end_at) {
      return res.status(400).json({ error: '시작 날짜는 종료 날짜보다 이전이어야 합니다' })
    }

    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 즉시 DB에 저장 (status는 'pending' - 스팸 체크 중)
    const event = await EventModel.create(
      req.userId,
      title,
      description,
      sport,
      region,
      sub_region,
      venue || null,
      start_at,
      end_at,
      website || null,
      organizer_user_name,
      'pending' // 초기 상태는 판정 중
    )

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
      region: event.region,
      sub_region: event.sub_region,
      venue: event.venue,
      address: event.address,
      start_at: event.start_at,
      end_at: event.end_at,
      website: event.website,
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

export default router

