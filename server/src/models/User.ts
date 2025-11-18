import pool from '../config/database.js'
import bcrypt from 'bcrypt'

export interface UserRow {
  id: number
  email: string
  name: string | null
  phone: string | null
  sport1: string | null
  sport2: string | null
  sport3: string | null
  is_verified: boolean
  manager: boolean
  status: string
  created_at: Date
  updated_at: Date | null
}

export interface UserWithPassword extends UserRow {
  password_hash: string
}

export class UserModel {
  /**
   * 이메일로 사용자 찾기 (비밀번호 포함)
   */
  static async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const [rows] = await pool.execute<UserWithPassword[]>(
      `SELECT u.id, u.email, u.name, u.phone, u.sport1, u.sport2, u.sport3, u.is_verified, u.manager, u.status, u.created_at, u.updated_at, uc.password_hash 
       FROM users u
       LEFT JOIN user_credentials uc ON u.id = uc.user_id
       WHERE u.email = ? AND u.status = 'active'`,
      [email]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * 이메일로 사용자 찾기
   */
  static async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, email, name, phone, sport1, sport2, sport3, is_verified, manager, status, created_at, updated_at FROM users WHERE email = ? AND status = "active"',
      [email]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * ID로 사용자 찾기
   */
  static async findById(id: number): Promise<UserRow | null> {
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, email, name, phone, sport1, sport2, sport3, is_verified, manager, status, created_at, updated_at FROM users WHERE id = ? AND status = "active"',
      [id]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * 비밀번호 검증
   */
  static async verifyPassword(userId: number, password: string): Promise<boolean> {
    const [rows] = await pool.execute<{ password_hash: string }[]>(
      'SELECT password_hash FROM user_credentials WHERE user_id = ?',
      [userId]
    )

    if (rows.length === 0) {
      return false
    }

    return bcrypt.compare(password, rows[0].password_hash)
  }

  /**
   * 새 사용자 생성
   */
  static async create(
    email: string,
    password: string,
    name: string,
    phone?: string,
    sport1?: string,
    sport2?: string,
    sport3?: string
  ): Promise<UserRow> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 사용자 생성 (is_verified를 true로 설정 - 회원가입 완료)
      const [result] = await connection.execute(
        `INSERT INTO users (email, name, phone, sport1, sport2, sport3, status, is_verified) 
         VALUES (?, ?, ?, ?, ?, ?, 'active', true)`,
        [email, name, phone || null, sport1 || null, sport2 || null, sport3 || null]
      )

      const insertResult = result as { insertId: number }
      const userId = insertResult.insertId

      // 비밀번호 해시 생성 및 저장
      const passwordHash = await bcrypt.hash(password, 10)
      await connection.execute(
        'INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)',
        [userId, passwordHash]
      )

      await connection.commit()

      // 생성된 사용자 반환
      const user = await this.findById(userId)
      if (!user) {
        throw new Error('사용자 생성 후 조회 실패')
      }

      return user
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 이메일 중복 확인 (is_verified가 true인 이메일만 체크)
   */
  static async isEmailExists(email: string): Promise<boolean> {
    const [rows] = await pool.execute<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM users WHERE email = ? AND is_verified = true',
      [email]
    )
    return rows[0].count > 0
  }

  /**
   * 사용자 삭제 (회원탈퇴)
   * 관련된 모든 데이터 삭제: session_tokens, user_oauth_connections, user_credentials, events
   */
  static async delete(userId: number): Promise<void> {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // 1. 세션 토큰 삭제
      await connection.execute(
        'DELETE FROM session_tokens WHERE user_id = ?',
        [userId]
      )

      // 2. OAuth 연결 삭제
      await connection.execute(
        'DELETE FROM user_oauth_connections WHERE user_id = ?',
        [userId]
      )

      // 3. 비밀번호 정보 삭제
      await connection.execute(
        'DELETE FROM user_credentials WHERE user_id = ?',
        [userId]
      )

      // 4. 사용자가 등록한 이벤트 삭제
      await connection.execute(
        'DELETE FROM events WHERE organizer_user_id = ?',
        [userId]
      )

      // 5. 사용자 삭제
      await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      )

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

