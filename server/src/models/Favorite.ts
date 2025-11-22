import pool from '../config/database.js'
import { RowDataPacket } from 'mysql2'

export interface FavoriteRow extends RowDataPacket {
  id: number
  user_id: number
  event_id: number
  created_at: Date
}

export class FavoriteModel {
  /**
   * 찜 추가
   */
  static async addFavorite(userId: number, eventId: number): Promise<void> {
    try {
      await pool.execute(
        'INSERT INTO favorites (user_id, event_id) VALUES (?, ?)',
        [userId, eventId]
      )
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('이미 찜한 행사입니다')
      }
      throw error
    }
  }

  /**
   * 찜 삭제
   */
  static async removeFavorite(userId: number, eventId: number): Promise<void> {
    await pool.execute(
      'DELETE FROM favorites WHERE user_id = ? AND event_id = ?',
      [userId, eventId]
    )
  }

  /**
   * 찜 여부 확인
   */
  static async isFavorite(userId: number, eventId: number): Promise<boolean> {
    const [rows] = await pool.execute<FavoriteRow[]>(
      'SELECT id FROM favorites WHERE user_id = ? AND event_id = ?',
      [userId, eventId]
    )
    return rows.length > 0
  }

  /**
   * 사용자의 찜 목록 조회 (행사 정보 포함)
   */
  static async getUserFavorites(userId: number): Promise<any[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        e.id,
        e.organizer_user_id,
        e.organizer_user_name,
        e.title,
        e.description,
        e.sport,
        e.sub_sport,
        e.region,
        e.sub_region,
        e.venue,
        e.address,
        e.start_at,
        e.end_at,
        e.website,
        e.image,
        e.eraser,
        e.created_at,
        f.created_at as favorited_at
      FROM favorites f
      JOIN events e ON f.event_id = e.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC`,
      [userId]
    )
    return rows
  }

  /**
   * 행사의 찜 개수 조회
   */
  static async getFavoriteCount(eventId: number): Promise<number> {
    const [rows] = await pool.execute<(RowDataPacket & { count: number })[]>(
      'SELECT COUNT(*) as count FROM favorites WHERE event_id = ?',
      [eventId]
    )
    return rows[0]?.count || 0
  }

  /**
   * 사용자-종목 선호도 행렬 생성 (코사인 유사도 계산용)
   * 각 사용자가 각 소분류 종목을 몇 번 찜했는지 집계
   */
  static async getUserSportPreferenceMatrix(): Promise<{
    matrix: { [userId: string]: { [sport: string]: number } }
    users: number[]
    sports: string[]
  }> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          f.user_id,
          e.sub_sport,
          COUNT(*) as count
        FROM favorites f
        JOIN events e ON f.event_id = e.id
        WHERE e.sub_sport IS NOT NULL
        GROUP BY f.user_id, e.sub_sport
        ORDER BY f.user_id, e.sub_sport`
      )

      // 모든 사용자와 종목 목록 추출
      const users = [...new Set(rows.map((row: any) => row.user_id))].sort((a, b) => a - b)
      const sports = [...new Set(rows.map((row: any) => row.sub_sport))].sort()

      // 행렬 초기화 (모든 값 0)
      const matrix: { [userId: string]: { [sport: string]: number } } = {}
      users.forEach(userId => {
        matrix[userId] = {}
        sports.forEach(sport => {
          matrix[userId][sport] = 0
        })
      })

      // 실제 찜 데이터로 행렬 채우기
      rows.forEach((row: any) => {
        matrix[row.user_id][row.sub_sport] = row.count
      })

      return { matrix, users, sports }
    } catch (error) {
      console.error('사용자-종목 선호도 행렬 생성 오류:', error)
      throw error
    }
  }
}

