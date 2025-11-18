import pool from '../config/database.js'
import crypto from 'crypto'
import { RowDataPacket } from 'mysql2'

export interface SessionTokenRow extends RowDataPacket {
  id: number
  user_id: number
  refresh_token_hash: string
  device_info: string | null
  ip: string | null
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
}

export class SessionTokenModel {
  /**
   * 리프레시 토큰 생성 및 저장
   */
  static async create(
    userId: number,
    deviceInfo?: string,
    ip?: string,
    expiresInDays: number = 7
  ): Promise<string> {
    // 리프레시 토큰 생성 (랜덤 문자열)
    const refreshToken = crypto.randomBytes(32).toString('hex')

    // 토큰 해시 생성
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    // 만료 시간 계산
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // DB에 저장
    await pool.execute(
      `INSERT INTO session_tokens (user_id, refresh_token_hash, device_info, ip, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, refreshTokenHash, deviceInfo || null, ip || null, expiresAt]
    )

    return refreshToken
  }

  /**
   * 리프레시 토큰 검증
   */
  static async verify(refreshToken: string): Promise<SessionTokenRow | null> {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    const [rows] = await pool.execute<SessionTokenRow[]>(
      `SELECT * FROM session_tokens 
       WHERE refresh_token_hash = ? 
       AND revoked_at IS NULL 
       AND expires_at > NOW()`,
      [refreshTokenHash]
    )

    return rows.length > 0 ? rows[0] : null
  }

  /**
   * 토큰 무효화 (로그아웃)
   */
  static async revoke(refreshToken: string): Promise<void> {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    await pool.execute(
      'UPDATE session_tokens SET revoked_at = NOW() WHERE refresh_token_hash = ?',
      [refreshTokenHash]
    )
  }

  /**
   * 사용자의 모든 토큰 무효화
   */
  static async revokeAll(userId: number): Promise<void> {
    await pool.execute(
      'UPDATE session_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    )
  }
}

