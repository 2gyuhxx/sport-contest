import pool from '../config/database.js'

export interface UserOAuthConnectionRow {
  id: number
  user_id: number
  provider_id: number
  oauth_user_id: string
  email_at_signup: string | null
  access_token_enc: string | null
  refresh_token_enc: string | null
  expires_at: Date | null
  revoked_at: Date | null
  last_login_at: Date | null
  created_at: Date
}

export class UserOAuthModel {
  /**
   * OAuth 사용자 ID로 연결 찾기
   */
  static async findByOAuthUserId(
    providerId: number,
    oauthUserId: string
  ): Promise<UserOAuthConnectionRow | null> {
    const [rows] = await pool.execute<UserOAuthConnectionRow[]>(
      `SELECT * FROM user_oauth_connections 
       WHERE provider_id = ? AND oauth_user_id = ? AND revoked_at IS NULL`,
      [providerId, oauthUserId]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * 사용자 ID로 OAuth 연결 찾기
   */
  static async findByUserId(userId: number): Promise<UserOAuthConnectionRow[]> {
    const [rows] = await pool.execute<UserOAuthConnectionRow[]>(
      `SELECT * FROM user_oauth_connections 
       WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    )
    return rows
  }

  /**
   * OAuth 연결 생성
   */
  static async create(
    userId: number,
    providerId: number,
    oauthUserId: string,
    emailAtSignup?: string,
    accessToken?: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<UserOAuthConnectionRow> {
    const [result] = await pool.execute(
      `INSERT INTO user_oauth_connections 
       (user_id, provider_id, oauth_user_id, email_at_signup, access_token_enc, refresh_token_enc, expires_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        providerId,
        oauthUserId,
        emailAtSignup || null,
        accessToken || null,
        refreshToken || null,
        expiresAt || null,
      ]
    )

    const insertResult = result as { insertId: number }
    const [rows] = await pool.execute<UserOAuthConnectionRow[]>(
      'SELECT * FROM user_oauth_connections WHERE id = ?',
      [insertResult.insertId]
    )
    return rows[0]
  }

  /**
   * 마지막 로그인 시간 업데이트
   */
  static async updateLastLogin(connectionId: number): Promise<void> {
    await pool.execute(
      'UPDATE user_oauth_connections SET last_login_at = NOW() WHERE id = ?',
      [connectionId]
    )
  }
}

