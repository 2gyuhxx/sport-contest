import pool from '../config/database.js'

/**
 * MySQL 이벤트 스케줄러 설정
 * 서버가 꺼져있어도 데이터베이스에서 자동으로 실행됩니다.
 */
export class EventScheduler {
  /**
   * MySQL 이벤트 스케줄러 활성화 확인 및 설정
   */
  static async ensureEventSchedulerEnabled(): Promise<void> {
    try {
      // 이벤트 스케줄러 상태 확인
      const [rows] = await pool.execute<any[]>(
        `SHOW VARIABLES LIKE 'event_scheduler'`
      )
      
      const eventSchedulerStatus = rows[0]?.Value || 'OFF'
      
      if (eventSchedulerStatus === 'OFF') {
        console.log('[이벤트 스케줄러] MySQL 이벤트 스케줄러가 비활성화되어 있습니다.')
        console.log('[이벤트 스케줄러] 활성화하려면 MySQL에 다음 명령을 실행하세요:')
        console.log('[이벤트 스케줄러] SET GLOBAL event_scheduler = ON;')
        console.log('[이벤트 스케줄러] 또는 MySQL 설정 파일(my.cnf)에 다음을 추가하세요:')
        console.log('[이벤트 스케줄러] event_scheduler = ON')
      } else {
        console.log('[이벤트 스케줄러] MySQL 이벤트 스케줄러가 활성화되어 있습니다.')
      }
    } catch (error) {
      console.error('[이벤트 스케줄러] 상태 확인 오류:', error)
    }
  }


  /**
   * 매 1시간마다 종료된 행사를 inactive로 변경하는 이벤트 생성
   */
  static async createHourlyStatusUpdateEvent(): Promise<void> {
    try {
      // 기존 이벤트가 있으면 삭제
      await pool.execute(`
        DROP EVENT IF EXISTS hourly_update_expired_events
      `)

      // 새 이벤트 생성 (매 1시간마다 실행)
      await pool.execute(`
        CREATE EVENT hourly_update_expired_events
        ON SCHEDULE EVERY 1 HOUR
        STARTS DATE_FORMAT(DATE_ADD(NOW(), INTERVAL 1 HOUR), '%Y-%m-%d %H:00:00')
        DO
        BEGIN
          -- 종료된 행사를 inactive로 변경
          UPDATE events 
          SET eraser = 'inactive', updated_at = NOW() 
          WHERE end_at < NOW()
          AND (eraser IS NULL OR eraser = 'active');
        END
      `)

      console.log('[이벤트 스케줄러] hourly_update_expired_events 이벤트가 생성되었습니다.')
      console.log('[이벤트 스케줄러] 매 1시간마다 종료된 행사를 자동으로 inactive로 변경합니다.')
    } catch (error: any) {
      console.error('[이벤트 스케줄러] 이벤트 생성 오류:', error)
      if (error.code === 'ER_CANNOT_USER') {
        console.error('[이벤트 스케줄러] 이벤트를 생성할 권한이 없습니다.')
        console.error('[이벤트 스케줄러] MySQL 사용자에게 EVENT 권한이 필요합니다.')
      }
    }
  }

  /**
   * 모든 이벤트 생성 및 설정
   */
  static async setupAllEvents(): Promise<void> {
    await this.ensureEventSchedulerEnabled()
    await this.createHourlyStatusUpdateEvent()
  }

  /**
   * 생성된 이벤트 목록 조회
   */
  static async listEvents(): Promise<void> {
    try {
      const [rows] = await pool.execute<any[]>(`
        SELECT 
          EVENT_NAME,
          EVENT_DEFINITION,
          INTERVAL_VALUE,
          INTERVAL_FIELD,
          STATUS,
          LAST_EXECUTED,
          NEXT_EXECUTION_TIME
        FROM information_schema.EVENTS
        WHERE EVENT_SCHEMA = DATABASE()
      `)

      if (rows.length === 0) {
        console.log('[이벤트 스케줄러] 생성된 이벤트가 없습니다.')
      } else {
        console.log('[이벤트 스케줄러] 생성된 이벤트 목록:')
        rows.forEach((event: any) => {
          console.log(`  - ${event.EVENT_NAME}: ${event.EVENT_DEFINITION}`)
          console.log(`    실행 주기: ${event.INTERVAL_VALUE} ${event.INTERVAL_FIELD}`)
          console.log(`    상태: ${event.STATUS}`)
          console.log(`    다음 실행: ${event.NEXT_EXECUTION_TIME}`)
        })
      }
    } catch (error) {
      console.error('[이벤트 스케줄러] 이벤트 목록 조회 오류:', error)
    }
  }
}

