import express from 'express'
import { FavoriteModel } from '../models/Favorite.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

/**
 * POST /api/favorites
 * 찜 추가
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const { eventId } = req.body

    if (!userId) {
      return res.status(401).json({ error: '로그인이 필요합니다' })
    }

    if (!eventId) {
      return res.status(400).json({ error: 'eventId가 필요합니다' })
    }

    await FavoriteModel.addFavorite(userId, eventId)
    res.status(201).json({ success: true, message: '관심 행사로 등록되었습니다' })
  } catch (error: any) {
    if (error.message.includes('이미 찜한')) {
      return res.status(409).json({ error: error.message })
    }
    console.error('찜 추가 오류:', error)
    res.status(500).json({ error: '찜 등록에 실패했습니다' })
  }
})

/**
 * DELETE /api/favorites/:eventId
 * 찜 삭제
 */
router.delete('/:eventId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const eventId = parseInt(req.params.eventId, 10)

    if (!userId) {
      return res.status(401).json({ error: '로그인이 필요합니다' })
    }

    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효한 eventId가 필요합니다' })
    }

    await FavoriteModel.removeFavorite(userId, eventId)
    res.json({ success: true, message: '관심 행사에서 제거되었습니다' })
  } catch (error) {
    console.error('찜 삭제 오류:', error)
    res.status(500).json({ error: '찜 삭제에 실패했습니다' })
  }
})

/**
 * GET /api/favorites/check/:eventId
 * 찜 여부 확인
 */
router.get('/check/:eventId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const eventId = parseInt(req.params.eventId, 10)

    if (!userId) {
      return res.json({ isFavorite: false })
    }

    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효한 eventId가 필요합니다' })
    }

    const isFavorite = await FavoriteModel.isFavorite(userId, eventId)
    res.json({ isFavorite })
  } catch (error) {
    console.error('찜 여부 확인 오류:', error)
    res.status(500).json({ error: '찜 여부 확인에 실패했습니다' })
  }
})

/**
 * GET /api/favorites
 * 사용자 찜 목록 조회
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: '로그인이 필요합니다' })
    }

    const favorites = await FavoriteModel.getUserFavorites(userId)
    res.json({ success: true, favorites })
  } catch (error) {
    console.error('사용자 찜 목록 조회 오류:', error)
    res.status(500).json({ error: '찜 목록 조회에 실패했습니다' })
  }
})

/**
 * GET /api/favorites/count/:eventId
 * 행사의 찜 개수 조회
 */
router.get('/count/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId, 10)

    if (isNaN(eventId)) {
      return res.status(400).json({ error: '유효한 eventId가 필요합니다' })
    }

    const count = await FavoriteModel.getFavoriteCount(eventId)
    res.json({ success: true, count })
  } catch (error) {
    console.error('찜 개수 조회 오류:', error)
    res.status(500).json({ error: '찜 개수 조회에 실패했습니다' })
  }
})

/**
 * GET /api/favorites/matrix
 * 사용자-종목 선호도 행렬 조회 (코사인 유사도 계산용)
 */
router.get('/matrix', async (req, res) => {
  try {
    const result = await FavoriteModel.getUserSportPreferenceMatrix()
    res.json({ 
      success: true, 
      ...result 
    })
  } catch (error) {
    console.error('사용자-종목 선호도 행렬 조회 오류:', error)
    res.status(500).json({ error: '행렬 조회에 실패했습니다' })
  }
})

export default router

