import express from 'express'
import jwt from 'jsonwebtoken'
import pool from '../config/database.js'
import { UserModel } from '../models/User.js'
import { SessionTokenModel } from '../models/SessionToken.js'
import { authenticateToken, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

// sport1, sport2, sport3를 콤마로 구분된 문자열로 변환하는 헬퍼 함수
function formatSports(user: any): string | null {
  const sportsArray = [user.sport1, user.sport2, user.sport3].filter(s => s !== null && s !== undefined)
  return sportsArray.length > 0 ? sportsArray.join(',') : null
}

/**
 * 회원가입
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, manager, sports, phone } = req.body

    // 입력 검증
    if (!email || !password || !name) {
      return res.status(400).json({ error: '이메일, 비밀번호, 이름을 입력해주세요' })
    }

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요' })
    }

    // 비밀번호 유효성 검사
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다' })
    }

    // 이름 유효성 검사
    if (name.length < 2) {
      return res.status(400).json({ error: '이름은 최소 2자 이상이어야 합니다' })
    }

    // 이메일 중복 확인
    const emailExists = await UserModel.isEmailExists(email)
    if (emailExists) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다' })
    }

    // 관심 종목을 sport1, sport2, sport3로 분리 (최대 3개)
    const sportArray = sports ? sports.split(',').filter(s => s.trim()) : []
    const sport1 = sportArray[0] || null
    const sport2 = sportArray[1] || null
    const sport3 = sportArray[2] || null

    // 사용자 생성
    const user = await UserModel.create(
      email,
      password,
      name,
      phone || null,
      sport1,
      sport2,
      sport3
    )

    // manager 필드 업데이트 (행사 관리자인 경우)
    if (manager) {
      await pool.execute(
        'UPDATE users SET manager = true WHERE id = ?',
        [user.id]
      )
      user.manager = true
    }

    // JWT 토큰 생성
    const jwtSecret = process.env.JWT_SECRET
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'

    if (!jwtSecret) {
      return res.status(500).json({ error: '서버 설정 오류' })
    }

    const accessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    })

    // 리프레시 토큰 생성 및 저장
    const deviceInfo = req.headers['user-agent'] || undefined
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress || 
               undefined
    const refreshToken = await SessionTokenModel.create(user.id, deviceInfo, ip)

    // 응답 데이터
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      sports: formatSports(user),
      manager: user.manager,
      is_verified: user.is_verified,
      created_at: user.created_at,
    }

    res.status(201).json({
      user: userData,
      accessToken,
      refreshToken,
    })
  } catch (error: any) {
    console.error('회원가입 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
    })
    
    // MySQL 중복 키 오류 처리
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다' })
    }
    
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
      ? '회원가입 중 오류가 발생했습니다'
      : error.message || '회원가입 중 오류가 발생했습니다'
    
    res.status(500).json({ 
      error: errorMessage,
      code: error.code,
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    })
  }
})

/**
 * 로그인
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // 입력 검증
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' })
    }

    // 사용자 찾기 (비밀번호 포함)
    const user = await UserModel.findByEmailWithPassword(email)
    if (!user) {
      return res.status(401).json({ error: '등록되지 않은 이메일입니다' })
    }

    // 비밀번호 확인
    if (!user.password_hash) {
      return res.status(401).json({ error: '일반 로그인이 불가능한 계정입니다' })
    }

    const isPasswordValid = await UserModel.verifyPassword(user.id, password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' })
    }

    // JWT 토큰 생성
    const jwtSecret = process.env.JWT_SECRET
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'

    if (!jwtSecret) {
      return res.status(500).json({ error: '서버 설정 오류' })
    }

    const accessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    })

    // 리프레시 토큰 생성 및 저장
    const deviceInfo = req.headers['user-agent'] || undefined
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress || 
               undefined
    const refreshToken = await SessionTokenModel.create(user.id, deviceInfo, ip)

    // 응답 데이터
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      sports: formatSports(user),
      manager: user.manager,
      is_verified: user.is_verified,
      created_at: user.created_at,
    }

    res.json({
      user: userData,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error('로그인 오류:', error)
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다' })
  }
})

/**
 * 토큰 갱신
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: '리프레시 토큰이 필요합니다' })
    }

    // 리프레시 토큰 검증
    const session = await SessionTokenModel.verify(refreshToken)
    if (!session) {
      return res.status(401).json({ error: '유효하지 않은 리프레시 토큰입니다' })
    }

    // 사용자 정보 가져오기
    const user = await UserModel.findById(session.user_id)
    if (!user) {
      return res.status(401).json({ error: '사용자를 찾을 수 없습니다' })
    }

    // 새로운 액세스 토큰 생성
    const jwtSecret = process.env.JWT_SECRET
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'

    if (!jwtSecret) {
      return res.status(500).json({ error: '서버 설정 오류' })
    }

    const accessToken = jwt.sign({ userId: user.id }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    })

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      sports: formatSports(user),
      manager: user.manager,
      is_verified: user.is_verified,
      created_at: user.created_at,
    }

    res.json({
      user: userData,
      accessToken,
    })
  } catch (error) {
    console.error('토큰 갱신 오류:', error)
    res.status(500).json({ error: '토큰 갱신 중 오류가 발생했습니다' })
  }
})

/**
 * 로그아웃
 */
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      // 리프레시 토큰 무효화
      await SessionTokenModel.revoke(refreshToken)
    } else if (req.userId) {
      // 모든 토큰 무효화
      await SessionTokenModel.revokeAll(req.userId)
    }

    res.json({ message: '로그아웃되었습니다' })
  } catch (error) {
    console.error('로그아웃 오류:', error)
    res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다' })
  }
})

/**
 * 현재 사용자 정보 가져오기
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    const user = await UserModel.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      sports: formatSports(user),
      manager: user.manager,
      is_verified: user.is_verified,
      created_at: user.created_at,
    }

    res.json({ user: userData })
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error)
    res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다' })
  }
})

/**
 * 사용자 정보 업데이트 (소셜 로그인 후 추가 정보 입력용)
 */
router.patch('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    const { manager, sports } = req.body

    // 사용자 찾기
    const user = await UserModel.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }

    // manager 필드 업데이트
    if (typeof manager === 'boolean') {
      await pool.execute(
        'UPDATE users SET manager = ? WHERE id = ?',
        [manager, req.userId]
      )
    }

    // is_verified 필드 업데이트 (소셜 로그인 후 추가 정보 입력 완료 시 true로 설정)
    await pool.execute(
      'UPDATE users SET is_verified = true WHERE id = ?',
      [req.userId]
    )

    // 관심 종목 업데이트
    if (sports !== undefined) {
      const sportArray = sports ? sports.split(',').filter((s: string) => s.trim()) : []
      const sport1 = sportArray[0] || null
      const sport2 = sportArray[1] || null
      const sport3 = sportArray[2] || null

      await pool.execute(
        'UPDATE users SET sport1 = ?, sport2 = ?, sport3 = ? WHERE id = ?',
        [sport1, sport2, sport3, req.userId]
      )
    }

    // 업데이트된 사용자 정보 반환
    const updatedUser = await UserModel.findById(req.userId)
    if (!updatedUser) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }

    const userData = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      sports: formatSports(updatedUser),
      manager: updatedUser.manager,
      is_verified: updatedUser.is_verified,
      created_at: updatedUser.created_at,
    }

    res.json({ user: userData })
  } catch (error) {
    console.error('사용자 정보 업데이트 오류:', error)
    res.status(500).json({ error: '사용자 정보 업데이트 중 오류가 발생했습니다' })
  }
})

/**
 * 회원탈퇴
 */
router.delete('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: '인증이 필요합니다' })
    }

    // 사용자 존재 확인
    const user = await UserModel.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' })
    }

    // 사용자 및 관련 데이터 삭제
    await UserModel.delete(req.userId)

    // 모든 세션 토큰 무효화 (이미 삭제되었지만 추가 안전장치)
    await SessionTokenModel.revokeAll(req.userId)

    res.json({ message: '회원탈퇴가 완료되었습니다' })
  } catch (error) {
    console.error('회원탈퇴 오류:', error)
    res.status(500).json({ error: '회원탈퇴 중 오류가 발생했습니다' })
  }
})

export default router

