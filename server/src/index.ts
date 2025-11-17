import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import googleAuthRoutes from './routes/googleAuth.js'
import kakaoAuthRoutes from './routes/kakaoAuth.js'
import eventRoutes from './routes/events.js'
import listRoutes from './routes/lists.js'
import categoryRoutes from './routes/categories.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

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
// 카테고리 라우트 (대분류, 소분류)
app.use('/api', categoryRoutes)

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
})

