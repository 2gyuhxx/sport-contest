import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import googleAuthRoutes from './routes/googleAuth.js'
import kakaoAuthRoutes from './routes/kakaoAuth.js'
import eventRoutes from './routes/events.js'
import listRoutes from './routes/lists.js'
import { downloadModelFromCloud } from './utils/downloadModel.js'
import { EventModel } from './models/Event.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 서버 시작 시 모델 파일 다운로드 (비동기, 서버 시작을 블로킹하지 않음)
downloadModelFromCloud()
  .then(() => {
    console.log('[서버 시작] 모델 파일 다운로드 완료')
  })
  .catch((error) => {
    console.error('[서버 시작] 모델 파일 다운로드 실패:', error)
    console.warn('[서버 시작] 모델 파일이 없어도 서버는 시작되지만 스팸 체크 기능이 작동하지 않을 수 있습니다.')
    console.warn('[서버 시작] .env 파일에 NHN Cloud Object Storage 설정을 확인해주세요.')
  })

// 끝난 지 2주가 지난 행사를 자동으로 삭제하는 스케줄러 (매일 새벽 3시에 실행)
function scheduleExpiredEventsCleanup() {
  const cleanup = async () => {
    try {
      const deletedCount = await EventModel.deleteExpiredEvents()
      if (deletedCount > 0) {
        console.log(`[자동 삭제] 끝난 지 2주가 지난 행사 ${deletedCount}개를 삭제했습니다.`)
      }
    } catch (error) {
      console.error('[자동 삭제] 오류:', error)
    }
  }

  // 서버 시작 시 즉시 한 번 실행
  cleanup()

  // 매 24시간마다 실행 (24시간 = 86400000ms)
  setInterval(cleanup, 24 * 60 * 60 * 1000)
  console.log('[자동 삭제] 스케줄러 시작: 매 24시간마다 끝난 지 2주가 지난 행사를 삭제합니다.')
}

// 미들웨어
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 요청 로깅 (개발용)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.includes('/google') || req.path.includes('/kakao')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
      console.log('Query:', req.query)
    }
    next()
  })
}

// 라우트
app.use('/api/auth', authRoutes)
// Google OAuth 라우트 - /api/auth와 /auth 모두 지원 (Google Cloud Console 설정에 따라)
app.use('/api/auth', googleAuthRoutes)
app.use('/auth', googleAuthRoutes) // Google Cloud Console에 /auth/google/callback로 등록된 경우
// 카카오 OAuth 라우트 - /api/auth와 /auth 모두 지원
app.use('/api/auth', kakaoAuthRoutes)
app.use('/auth', kakaoAuthRoutes) // 카카오 개발자 콘솔에 /auth/kakao/callback로 등록된 경우
// 행사 라우트
app.use('/api/events', eventRoutes)
// 목록 라우트 (스포츠 종목, 지역, 시군구)
app.use('/api/lists', listRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

// 에러 핸들러
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('에러:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  // 자동 삭제 스케줄러 시작
  scheduleExpiredEventsCleanup()
})

