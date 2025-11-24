import pool from '../config/database.js'
import type { RowDataPacket } from 'mysql2'

export type EventStatus = 'pending' | 'approved' | 'spam'
export type EventLifecycleStatus = 'active' | 'inactive'

export interface EventRow extends RowDataPacket {
  id: number
  organizer_user_id: number
  organizer_user_name: string | null
  title: string
  description: string
  sport: string
  sub_sport: string | null
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  start_at: Date
  end_at: Date
  website: string | null
  image: string | null
  views: number
  status: EventStatus
  eraser: EventLifecycleStatus | null
  reports_count?: number
  reports_state?: 'normal' | 'pending' | 'blocked'
  created_at: Date
  updated_at: Date | null
}

export class EventModel {
  /**
   * ID로 행사 찾기
   */
  static async findById(id: number): Promise<EventRow | null> {
    const [rows] = await pool.execute<EventRow[]>(
      'SELECT * FROM events WHERE id = ?',
      [id]
    )
    return rows.length > 0 ? rows[0] : null
  }

  /**
   * 새 행사 생성
   */
  static async create(
    organizerUserId: number,
    title: string,
    description: string,
    sport: string,
    subSport: string | null,
    region: string,
    subRegion: string,
    venue: string | null,
    address: string | null,
    startAt: string,
    endAt: string,
    website: string | null,
    image: string | null,
    organizerUserName: string,
    status: EventStatus = 'pending'
  ): Promise<EventRow> {
    console.log('[EventModel.create] 파라미터:', {
      organizerUserId,
      organizerUserName,
      title,
      description,
      sport,
      subSport,
      region,
      subRegion,
      venue,
      address,
      startAt,
      endAt,
      website,
      image,
      status
    })

    // 종료일 기준으로 eraser 상태 설정
    const now = new Date()
    const endDate = new Date(endAt)
    // 종료일이 현재보다 늦으면 active, 지났으면 inactive
    const eraser: EventLifecycleStatus = endDate.getTime() > now.getTime() ? 'active' : 'inactive'

    console.log('[EventModel.create] eraser 상태 설정:', {
      now: now.toISOString(),
      endAt,
      endDate: endDate.toISOString(),
      eraser
    })

    const [result] = await pool.execute(
      `INSERT INTO events (organizer_user_id, organizer_user_name, title, description, sport, sub_sport, region, sub_region, venue, address, start_at, end_at, website, image, status, eraser)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizerUserId, organizerUserName, title, description, sport, subSport || null, region, subRegion, venue || null, address || null, startAt, endAt, website || null, image || null, status, eraser]
    )

    console.log('[EventModel.create] INSERT 결과:', result)

    const insertResult = result as { insertId: number }
    const eventId = insertResult.insertId

    // 생성된 행사 반환
    const event = await this.findById(eventId)
    if (!event) {
      throw new Error('행사 생성 후 조회 실패')
    }

    return event
  }

  /**
   * 사용자가 생성한 행사 목록 가져오기
   */
  static async findByOrganizerId(organizerUserId: number): Promise<EventRow[]> {
    const [rows] = await pool.execute<EventRow[]>(
      'SELECT * FROM events WHERE organizer_user_id = ? ORDER BY created_at DESC',
      [organizerUserId]
    )
    return rows
  }

  /**
   * 행사 상태 업데이트
   */
  static async updateStatus(eventId: number, status: EventStatus): Promise<void> {
    await pool.execute(
      'UPDATE events SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, eventId]
    )
  }

  /**
   * 행사 정보 업데이트
   */
  static async update(
    eventId: number,
    organizerUserId: number,
    title: string,
    description: string,
    sport: string,
    subSport: string | null,
    region: string,
    subRegion: string,
    venue: string | null,
    address: string | null,
    startAt: string,
    endAt: string,
    website: string | null,
    image: string | null,
    organizerUserName: string
  ): Promise<EventRow> {
    // 먼저 행사 존재 확인 및 권한 확인
    const event = await this.findById(eventId)
    if (!event) {
      throw new Error('행사를 찾을 수 없습니다')
    }

    if (event.organizer_user_id !== organizerUserId) {
      throw new Error('행사를 수정할 권한이 없습니다')
    }

    // 종료일 기준으로 eraser 상태 재설정
    const now = new Date()
    const endDate = new Date(endAt)
    const eraser: EventLifecycleStatus = endDate.getTime() > now.getTime() ? 'active' : 'inactive'

    await pool.execute(
      `UPDATE events 
       SET title = ?, description = ?, sport = ?, sub_sport = ?, region = ?, sub_region = ?, 
           venue = ?, address = ?, start_at = ?, end_at = ?, website = ?, image = ?, organizer_user_name = ?, eraser = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, description, sport, subSport || null, region, subRegion, venue || null, address || null, startAt, endAt, website || null, image || null, organizerUserName, eraser, eventId]
    )

    // 업데이트된 행사 반환
    const updatedEvent = await this.findById(eventId)
    if (!updatedEvent) {
      throw new Error('행사 업데이트 후 조회 실패')
    }

    // 업데이트 시 status를 'pending'으로 변경 (재검토 필요)
    await this.updateStatus(eventId, 'pending')

    return updatedEvent
  }

  /**
   * 행사 삭제
   */
  static async delete(eventId: number): Promise<void> {
    await pool.execute(
      'DELETE FROM events WHERE id = ?',
      [eventId]
    )
  }

  /**
   * 모든 행사 가져오기 (승인된 행사만)
   */
  /**
   * 모든 행사 가져오기 (승인된 행사만, reports_state가 'normal'인 행사만)
   */
  static async findAll(): Promise<EventRow[]> {
    const [rows] = await pool.execute<EventRow[]>(
      `SELECT * FROM events 
       WHERE status = ? 
       AND (reports_state IS NULL OR reports_state = 'normal')
       ORDER BY created_at DESC`,
      ['approved']
    )
    return rows
  }

  /**
   * 관리자용: 모든 행사 가져오기 (상태 필터링 없이 전체)
   */
  static async findAllForAdmin(): Promise<EventRow[]> {
    const [rows] = await pool.execute<EventRow[]>(
      `SELECT * FROM events 
       ORDER BY created_at DESC`
    )
    return rows
  }

  /**
   * 조회수 증가
   */
  static async incrementViews(eventId: number): Promise<void> {
    await pool.execute(
      'UPDATE events SET views = views + 1, updated_at = NOW() WHERE id = ?',
      [eventId]
    )
  }

  /**
   * 종료된 행사를 inactive로 변경
   */
  static async updateExpiredToInactive(): Promise<number> {
    // MySQL의 NOW()를 직접 사용하여 타임존 문제 방지
    const now = new Date()
    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')
    
    console.log('[updateExpiredToInactive] 날짜 비교 시작:', {
      now: now.toISOString(),
      nowStr,
      criteria: `end_at < NOW()`
    })
    
    // 종료된 행사 조회 (디버깅용) - MySQL NOW() 사용
    const [expiredRows] = await pool.execute<EventRow[]>(
      `SELECT id, title, end_at, eraser FROM events 
       WHERE end_at < NOW()
       AND (eraser IS NULL OR eraser = 'active')`,
    )
    
    console.log('[updateExpiredToInactive] 종료된 행사 (업데이트 대상):', expiredRows.map(e => ({
      id: e.id,
      title: e.title,
      end_at: e.end_at,
      eraser: e.eraser,
      end_at_type: typeof e.end_at,
      end_at_value: String(e.end_at)
    })))
    
    // MySQL NOW()를 직접 사용하여 타임존 문제 방지
    const [result] = await pool.execute(
      `UPDATE events 
       SET eraser = 'inactive', updated_at = NOW() 
       WHERE end_at < NOW()
       AND (eraser IS NULL OR eraser = 'active')`,
    )
    
    const updateResult = result as { affectedRows: number }
    console.log('[updateExpiredToInactive] 업데이트 결과:', {
      affectedRows: updateResult.affectedRows || 0,
      updatedRows: updateResult.affectedRows || 0
    })
    
    // 업데이트된 행사 확인
    if (updateResult.affectedRows && updateResult.affectedRows > 0) {
      const [updatedEvents] = await pool.execute<EventRow[]>(
        `SELECT id, title, end_at, eraser FROM events 
         WHERE eraser = 'inactive' 
         AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`
      )
      console.log('[updateExpiredToInactive] inactive로 변경된 행사:', updatedEvents.map(e => ({
        id: e.id,
        title: e.title,
        end_at: e.end_at,
        eraser: e.eraser
      })))
    }
    
    return updateResult.affectedRows || 0
  }

}

