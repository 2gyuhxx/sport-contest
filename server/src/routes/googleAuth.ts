import express from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt, { SignOptions } from 'jsonwebtoken'
import pool from '../config/database.js'
import { UserModel } from '../models/User.js'
import { OAuthProviderModel } from '../models/OAuthProvider.js'
import { UserOAuthModel } from '../models/UserOAuth.js'
import { SessionTokenModel } from '../models/SessionToken.js'

const router = express.Router()

// Google OAuth 클라이언트 초기화
const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  // Google Cloud Console에 등록된 리다이렉션 URI와 일치해야 함
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://wherehani.com/auth/google/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

/**
 * Google 로그인 시작 (프론트엔드에서 이 URL로 리다이렉트)
 */
router.get('/google', (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    
    console.log('Google OAuth 설정 확인:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length,
    })

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials missing:', {
        GOOGLE_CLIENT_ID: !!clientId,
        GOOGLE_CLIENT_SECRET: !!clientSecret,
      })
      return res.status(500).json({ 
        error: 'Google 로그인 설정 오류',
        details: '환경 변수가 설정되지 않았습니다. 서버를 재시작해주세요.'
      })
    }

    const client = getGoogleClient()
    const scopes = ['openid', 'profile', 'email']
    
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // refresh token을 받기 위해 필요
    })

    console.log('Google OAuth URL 생성 성공')
    console.log('생성된 Auth URL:', authUrl)
    console.log('리다이렉트 URI:', process.env.GOOGLE_REDIRECT_URI || 'http://wherehani.com/auth/google/callback')
    res.redirect(authUrl)
  } catch (error: any) {
    console.error('Google OAuth 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
    })
    res.status(500).json({ 
      error: 'Google 로그인 설정 오류',
      details: error.message 
    })
  }
})

/**
 * Google OAuth 콜백 처리
 */
router.get('/google/callback', async (req, res) => {
  console.log('=== Google OAuth 콜백 요청 받음 ===')
  console.log('Query params:', req.query)
  console.log('URL:', req.url)
  console.log('Method:', req.method)
  
  try {
    const { code, error } = req.query

    // Google에서 오류가 발생한 경우
    if (error) {
      console.error('Google OAuth 오류:', error)
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=oauth_failed`)
    }

    if (!code || typeof code !== 'string') {
      console.error('Google OAuth: code가 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=oauth_failed`)
    }

    console.log('Google OAuth 콜백 시작, code:', code.substring(0, 20) + '...')

    const client = getGoogleClient()
    
    // 토큰 교환
    console.log('토큰 교환 시작...')
    const { tokens } = await client.getToken(code)
    console.log('토큰 교환 성공')
    client.setCredentials(tokens)

    // 사용자 정보 가져오기
    console.log('ID 토큰 검증 시작...')
    if (!tokens.id_token) {
      console.error('ID 토큰이 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=oauth_failed`)
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      console.error('페이로드를 가져올 수 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=oauth_failed`)
    }

    console.log('사용자 정보 가져오기 성공:', payload.email)

    const googleId = payload.sub
    const email = payload.email
    const name = payload.name || email?.split('@')[0] || 'User'
    const picture = payload.picture

    // Google Provider 찾기 또는 생성
    const provider = await OAuthProviderModel.findOrCreate('google', 'Google')

    // 기존 OAuth 연결 확인
    let oauthConnection = await UserOAuthModel.findByOAuthUserId(provider.id, googleId)
    let user
    let isNewUser = false

    if (oauthConnection) {
      // 기존 사용자 - 로그인
      user = await UserModel.findById(oauthConnection.user_id)
      if (!user) {
        return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=user_not_found`)
      }

      // 마지막 로그인 시간 업데이트
      await UserOAuthModel.updateLastLogin(oauthConnection.id)
    } else {
      // 새 사용자 - 회원가입 또는 기존 이메일과 연결
      // is_verified = true인 이메일이 이미 존재하는지 확인 (중복 가입 방지)
      if (email) {
        const emailExists = await UserModel.isEmailExists(email)
        if (emailExists) {
          console.error('이미 가입된 이메일입니다:', email)
          return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=email_already_exists`)
        }
      }
      
      user = await UserModel.findByEmail(email || '')

      if (!user) {
        // 새 사용자 생성
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()

          // users 테이블에 사용자 생성
          const [result] = await connection.execute(
            `INSERT INTO users (email, name, status, is_verified) 
             VALUES (?, ?, 'active', true)`,
            [email, name]
          )

          const insertResult = result as { insertId: number }
          const userId = insertResult.insertId

          // OAuth 연결 생성 (트랜잭션 내에서 같은 연결 사용)
          await connection.execute(
            `INSERT INTO user_oauth_connections 
             (user_id, provider_id, oauth_user_id, email_at_signup, access_token_enc, refresh_token_enc, expires_at, last_login_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              userId,
              provider.id,
              googleId,
              email || null,
              tokens.access_token || null,
              tokens.refresh_token || null,
              tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            ]
          )

          await connection.commit()
          connection.release()

          user = await UserModel.findById(userId)
          if (!user) {
            throw new Error('사용자 생성 후 조회 실패')
          }
          isNewUser = true // 새 사용자 플래그 설정
        } catch (error) {
          await connection.rollback()
          connection.release()
          throw error
        }
      } else {
        // 기존 사용자 - OAuth 연결 추가
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          
          await connection.execute(
            `INSERT INTO user_oauth_connections 
             (user_id, provider_id, oauth_user_id, email_at_signup, access_token_enc, refresh_token_enc, expires_at, last_login_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              user.id,
              provider.id,
              googleId,
              email || null,
              tokens.access_token || null,
              tokens.refresh_token || null,
              tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            ]
          )
          
          await connection.commit()
          connection.release()
        } catch (error) {
          await connection.rollback()
          connection.release()
          throw error
        }
      }
    }

    // JWT 토큰 생성
    const jwtSecret = process.env.JWT_SECRET
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'

    if (!jwtSecret) {
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=server_error`)
    }

    const accessToken = jwt.sign(
      { userId: user.id }, 
      jwtSecret as string, 
      { expiresIn: jwtExpiresIn } as SignOptions
    )

    // 리프레시 토큰 생성
    const deviceInfo = req.headers['user-agent'] || undefined
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress || 
               undefined
    const refreshToken = await SessionTokenModel.create(user.id, deviceInfo, ip)

    // 프론트엔드로 리다이렉트 (토큰을 쿼리 파라미터로 전달)
    const frontendUrl = process.env.CORS_ORIGIN || 'http://wherehani.com'
    let redirectUrl = `${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`
    if (isNewUser) {
      redirectUrl += '&isNewUser=true'
    }
    console.log('프론트엔드로 리다이렉트:', redirectUrl)
    res.redirect(redirectUrl)
  } catch (error: any) {
    console.error('Google OAuth 콜백 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    res.redirect(`${process.env.CORS_ORIGIN || 'http://wherehani.com'}/login?error=oauth_failed`)
  }
})

export default router

