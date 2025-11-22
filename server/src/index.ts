import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import googleAuthRoutes from './routes/googleAuth.js'
import kakaoAuthRoutes from './routes/kakaoAuth.js'
import eventRoutes from './routes/events.js'
import listRoutes from './routes/lists.js'
import uploadRoutes from './routes/upload.js'
import categoryRoutes from './routes/categories.js'
import { EventModel } from './models/Event.js'
import pool from './config/database.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// 미들웨어
// CORS 설정: 개발 환경과 프로덕션 환경 모두 지원
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://wherehani.com']

app.use(cors({
  origin: (origin, callback) => {
    // origin이 없으면 (서버 간 요청, OAuth 콜백 등) 허용
    if (!origin) {
      return callback(null, true)
    }
    
    // 허용된 origin 목록에 있으면 허용
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    
    // 개발 환경에서는 localhost 허용
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true)
    }
    
    // 프로덕션 환경에서 wherehani.com 도메인 허용 (www 포함)
    if (origin.includes('wherehani.com')) {
      return callback(null, true)
    }
    
    // 그 외의 경우 차단
    console.warn('CORS 차단된 origin:', origin)
    callback(new Error('CORS 정책에 의해 차단되었습니다'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
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
// 파일 업로드 라우트
app.use('/api/upload', uploadRoutes)
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

// 데이터베이스 연결 테스트
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection()
    console.log('✅ 데이터베이스 연결 성공')
    console.log('📊 데이터베이스 정보:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '3306',
      database: process.env.DB_NAME || 'sport_contest',
      user: process.env.DB_USER || 'root',
    })
    connection.release()
    return true
  } catch (error: any) {
    console.error('❌ 데이터베이스 연결 실패:', error.message)
    console.error('📋 환경변수 확인:', {
      DB_HOST: process.env.DB_HOST || '(기본값: localhost)',
      DB_PORT: process.env.DB_PORT || '(기본값: 3306)',
      DB_USER: process.env.DB_USER || '(기본값: root)',
      DB_NAME: process.env.DB_NAME || '(기본값: sport_contest)',
      DB_PASSWORD: process.env.DB_PASSWORD ? '***' : '(설정되지 않음)',
    })
    return false
  }
}

// 서버 시작
async function startServer() {
  // 데이터베이스 연결 테스트
  const dbConnected = await testDatabaseConnection()
  
  if (!dbConnected) {
    console.error('⚠️  데이터베이스 연결 실패. 서버는 시작되지만 일부 기능이 작동하지 않을 수 있습니다.')
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`)
    console.log(`🌐 CORS 허용 Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173, http://wherehani.com'}`)
  })
}

startServer().catch((error) => {
  console.error('서버 시작 실패:', error)
  process.exit(1)
})


