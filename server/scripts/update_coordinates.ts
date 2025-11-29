/**
 * 기존 행사들의 null 좌표를 일괄 업데이트하는 스크립트
 * 
 * 실행 방법:
 * cd server
 * npx tsx scripts/update_coordinates.ts
 */

import pool from '../src/config/database.js'
import { geocodeAddress } from '../src/utils/geocoding.js'
import type { RowDataPacket } from 'mysql2'

interface EventRow extends RowDataPacket {
  id: number
  title: string
  address: string | null
  venue: string | null
  lat: number | null
  lng: number | null
}

async function updateCoordinates() {
  console.log('========================================')
  console.log('좌표 일괄 업데이트 스크립트 시작')
  console.log('========================================\n')

  try {
    // lat 또는 lng가 null인 행사들 조회
    const [rows] = await pool.execute<EventRow[]>(
      'SELECT id, title, address, venue, lat, lng FROM events WHERE lat IS NULL OR lng IS NULL'
    )

    console.log(`✓ null 좌표를 가진 행사: ${rows.length}개\n`)

    if (rows.length === 0) {
      console.log('✓ 모든 행사의 좌표가 이미 설정되어 있습니다.')
      process.exit(0)
    }

    let successCount = 0
    let failCount = 0
    let skipCount = 0

    for (let i = 0; i < rows.length; i++) {
      const event = rows[i]
      console.log(`[${i + 1}/${rows.length}] ${event.title}`)
      console.log(`  - 주소: ${event.address || '없음'}`)
      console.log(`  - 장소: ${event.venue || '없음'}`)

      // 주소가 없으면 스킵
      if (!event.address && !event.venue) {
        console.log(`  ✗ 주소/장소 정보 없음 - 스킵\n`)
        skipCount++
        continue
      }

      // venue가 있으면 venue 사용 (실제 주소가 포함되어 있음)
      // address는 우편번호만 있어서 geocoding 불가
      const geocodeTarget = event.venue || event.address
      
      // 우편번호만 있는 경우 스킵
      if (geocodeTarget && /^\d{5}$/.test(geocodeTarget.trim())) {
        console.log(`  ✗ 우편번호만 있음 (${geocodeTarget}) - 스킵\n`)
        skipCount++
        continue
      }

      // 좌표 변환
      const coords = await geocodeAddress(geocodeTarget!)
      
      if (coords) {
        // DB 업데이트
        await pool.execute(
          'UPDATE events SET lat = ?, lng = ? WHERE id = ?',
          [coords.lat, coords.lng, event.id]
        )
        
        console.log(`  ✓ 좌표 업데이트 완료: {lat: ${coords.lat}, lng: ${coords.lng}}\n`)
        successCount++
      } else {
        console.log(`  ✗ 좌표 변환 실패\n`)
        failCount++
      }

      // API 요청 제한을 피하기 위한 지연 (100ms)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n========================================')
    console.log('좌표 업데이트 완료')
    console.log('========================================')
    console.log(`총 ${rows.length}개 행사`)
    console.log(`✓ 성공: ${successCount}개`)
    console.log(`✗ 실패: ${failCount}개`)
    console.log(`- 스킵: ${skipCount}개`)
    console.log('========================================\n')

    process.exit(0)
  } catch (error) {
    console.error('\n오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
updateCoordinates()

