import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: number
  user?: {
    id: number
  }
}

/**
 * JWT 토큰 검증 미들웨어
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ error: '서버 설정 오류' })
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다' })
    }

    const payload = decoded as { userId: number }
    req.userId = payload.userId
    req.user = { id: payload.userId } // user 객체도 설정
    next()
  })
}

