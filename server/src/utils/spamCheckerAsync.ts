import { checkSpam } from './spamChecker.js'
import { EventModel } from '../models/Event.js'

/**
 * 비동기로 스팸 체크를 수행하고 결과를 DB에 업데이트
 * title이 스팸이면 즉시 스팸으로 판정 (description 체크 생략)
 * 스팸이 아니면 approved로, 스팸이면 spam으로 상태 업데이트
 */
export async function checkSpamAsync(eventId: number, title: string, description: string): Promise<void> {
  const MAX_RETRIES = 3
  
  console.log(`\n[스팸 체크] 행사 ${eventId} 스팸 체크 시작`)
  console.log(`[스팸 체크] 제목: "${title?.substring(0, 100)}${title && title.length > 100 ? '...' : ''}"`)
  
  for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
    try {
      if (retryCount > 0) {
        console.log(`[스팸 체크] 행사 ${eventId} 재시도 (${retryCount + 1}/${MAX_RETRIES})`)
      }
      
      const isSpam = await checkSpam(title, description)
      
      // 결과에 따라 상태 업데이트
      const status = isSpam ? 'spam' : 'approved'
      await EventModel.updateStatus(eventId, status)
      
      console.log(`[스팸 체크] 행사 ${eventId} 스팸 체크 완료 → 상태: ${status}`)
      return
    } catch (error) {
      const isLastRetry = retryCount === MAX_RETRIES - 1
      
      if (isLastRetry) {
        // 최대 재시도 횟수 초과 시 안전하게 스팸으로 처리
        console.error(`[스팸 체크] 행사 ${eventId} 스팸 체크 최대 재시도 횟수 초과. 스팸으로 처리합니다.`)
        await EventModel.updateStatus(eventId, 'spam')
        console.log(`[스팸 체크] 행사 ${eventId} 최종 상태: spam (재시도 실패)`)
        return
      }
      
      console.error(`[스팸 체크] 행사 ${eventId} 스팸 체크 오류 (시도 ${retryCount + 1}/${MAX_RETRIES}):`, error)
      
      // 재시도 전 대기 (지수 백오프)
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000)
      console.log(`[스팸 체크] 행사 ${eventId} 재시도 전 ${waitTime}ms 대기...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
}

