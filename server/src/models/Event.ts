import pool from '../config/database.js'

export type EventStatus = 'pending' | 'approved' | 'spam'

export interface EventRow {
  id: number
  organizer_user_id: number
  organizer_user_name: string | null
  title: string
  description: string
  sport: string
  region: string
  sub_region: string
  venue: string | null
  address: string | null
  start_at: Date
  end_at: Date
  website: string | null
  status: EventStatus
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
    region: string,
    subRegion: string,
    venue: string | null,
    startAt: string,
    endAt: string,
    website: string | null,
    organizerUserName: string,
    status: EventStatus = 'pending'
  ): Promise<EventRow> {
    const [result] = await pool.execute(
      `INSERT INTO events (organizer_user_id, organizer_user_name, title, description, sport, region, sub_region, venue, address, start_at, end_at, website, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organizerUserId, organizerUserName, title, description, sport, region, subRegion, venue || null, null, startAt, endAt, website || null, status]
    )

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
    region: string,
    subRegion: string,
    venue: string | null,
    startAt: string,
    endAt: string,
    website: string | null,
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

    await pool.execute(
      `UPDATE events 
       SET title = ?, description = ?, sport = ?, region = ?, sub_region = ?, 
           venue = ?, start_at = ?, end_at = ?, website = ?, organizer_user_name = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, description, sport, region, subRegion, venue || null, startAt, endAt, website || null, organizerUserName, eventId]
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
   * 끝난 지 2주가 지난 행사들을 자동으로 삭제
   */
  static async deleteExpiredEvents(): Promise<number> {
    // 현재 시간에서 2주 전 시간 계산
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    const [result] = await pool.execute(
      'DELETE FROM events WHERE end_at < ?',
      [twoWeeksAgo.toISOString().slice(0, 19).replace('T', ' ')]
    )
    
    const deleteResult = result as { affectedRows: number }
    return deleteResult.affectedRows || 0
  }

  /**
   * 행사가 활성화 상태인지 확인 (end_at이 현재 시간보다 이후면 활성화)
   */
  static isActive(endAt: Date | string): boolean {
    const endDate = typeof endAt === 'string' ? new Date(endAt) : endAt
    const now = new Date()
    return endDate >= now
  }

  /**
   * 모든 행사 가져오기
   */
  static async findAll(): Promise<EventRow[]> {
    const [rows] = await pool.execute<EventRow[]>(
      'SELECT * FROM events ORDER BY created_at DESC'
    )
    return rows
  }
}

