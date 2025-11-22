import express from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import pool from '../config/database.js'
import { UserModel } from '../models/User.js'
import { OAuthProviderModel } from '../models/OAuthProvider.js'
import { UserOAuthModel } from '../models/UserOAuth.js'
import { SessionTokenModel } from '../models/SessionToken.js'

const router = express.Router()

// 카카오 API 응답 타입 정의
interface KakaoTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface KakaoUserInfo {
  id: number
  kakao_account?: {
    email?: string
    name?: string
    profile?: {
      nickname?: string
      nickName?: string
      profile_image_url?: string
    }
    profile_image?: string
  }
  properties?: {
    nickname?: string
    nickName?: string
    name?: string
    profile_image?: string
  }
}

// 카카오 OAuth 설정 (매 요청마다 최신 환경 변수 읽기)
const getKakaoConfig = () => {
  const clientId = process.env.KAKAO_REST_API_KEY
  const redirectUri = process.env.KAKAO_REDIRECT_URI || 'http://wherehani.com/api/auth/kakao/callback'
  
  return { clientId, redirectUri }
}

/**
 * 카카오 로그인 시작
 */
router.get('/kakao', (req, res) => {
  // 강제로 로그 출력 (버퍼링 방지)
  process.stdout.write('\n========================================\n')
  process.stdout.write('=== 카카오 로그인 시작 요청 받음 ===\n')
  process.stdout.write(`시간: ${new Date().toISOString()}\n`)
  process.stdout.write(`요청 URL: ${req.url}\n`)
  process.stdout.write(`요청 메서드: ${req.method}\n`)
  process.stdout.write(`요청 IP: ${req.ip || req.socket.remoteAddress}\n`)
  process.stdout.write('========================================\n\n')
  
  console.log('\n========================================')
  console.log('=== 카카오 로그인 시작 요청 받음 ===')
  console.log('시간:', new Date().toISOString())
  console.log('요청 URL:', req.url)
  console.log('요청 메서드:', req.method)
  console.log('요청 IP:', req.ip || req.socket.remoteAddress)
  console.log('========================================\n')
  
  const { clientId, redirectUri } = getKakaoConfig()
  
  console.log('환경 변수 확인:', {
    hasKAKAO_CLIENT_ID: !!clientId,
    KAKAO_CLIENT_ID_length: clientId?.length,
    KAKAO_REDIRECT_URI: redirectUri,
  })
  
  try {
    if (!clientId) {
      console.error('카카오 REST API 키가 설정되지 않았습니다')
      const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173'
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }

    if (!redirectUri) {
      console.error('카카오 리다이렉트 URI가 설정되지 않았습니다')
      const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173'
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }

    // 카카오 OAuth 인증 URL 생성 (닉네임, 프로필 이미지 요청 - 이메일은 권한 없음)
    // prompt=login: 매번 카카오 계정 선택 및 로그인 화면 표시
    // prompt=consent: 동의 화면을 강제로 표시하여 사용자가 다시 동의할 수 있도록 함
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile_nickname,profile_image&prompt=login,consent`
    
    console.log('카카오 OAuth URL 생성 성공')
    console.log('생성된 Auth URL:', kakaoAuthUrl)
    console.log('리다이렉트 URI:', redirectUri)
    res.redirect(kakaoAuthUrl)
  } catch (error: any) {
    console.error('카카오 OAuth 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
    })
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173'
    res.redirect(`${frontendUrl}/login?error=oauth_failed`)
  }
})

/**
 * 카카오 OAuth 콜백 처리
 */
router.get('/kakao/callback', async (req, res) => {
  console.log('\n========================================')
  console.log('=== 카카오 OAuth 콜백 요청 받음 ===')
  console.log('시간:', new Date().toISOString())
  console.log('요청 URL:', req.url)
  console.log('Query params:', req.query)
  console.log('========================================\n')
  
  const { clientId, redirectUri } = getKakaoConfig()
  
  try {
    const { code, error } = req.query

    // 카카오에서 오류가 발생한 경우
    if (error) {
      console.error('카카오 OAuth 오류:', error)
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    if (!code || typeof code !== 'string') {
      console.error('카카오 OAuth: code가 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    console.log('카카오 OAuth 콜백 시작, code:', code.substring(0, 20) + '...')

    // 1. 인가 코드로 액세스 토큰 받기
    console.log('액세스 토큰 요청 시작...')
    console.log('사용할 설정:', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : '없음',
      redirectUri,
    })
    
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('카카오 토큰 요청 실패:', errorData)
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    const tokenData = await tokenResponse.json() as KakaoTokenResponse
    const accessToken = tokenData.access_token
    const refreshToken = tokenData.refresh_token
    const expiresIn = tokenData.expires_in // 초 단위

    if (!accessToken) {
      console.error('액세스 토큰을 받을 수 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    console.log('액세스 토큰 받기 성공')

    // 2. 액세스 토큰으로 사용자 정보 가져오기
    // 카카오 개발자 콘솔에서 동의 항목 설정 필요 (닉네임, 프로필 사진)
    console.log('사용자 정보 요청 시작...')
    console.log('액세스 토큰 (처음 20자):', accessToken.substring(0, 20) + '...')
    
    // 카카오 API 호출 - GET 요청으로 사용자 정보 가져오기
    // secure_resource=true: HTTPS 프로필 이미지 URL 요청
    const userInfoUrl = 'https://kapi.kakao.com/v2/user/me?secure_resource=true'
    console.log('카카오 API 요청 URL:', userInfoUrl)
    
    const userInfoResponse = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    console.log('카카오 API 응답 상태:', userInfoResponse.status, userInfoResponse.statusText)

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      console.error('카카오 사용자 정보 요청 실패:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorText,
      })
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    const userInfo = await userInfoResponse.json() as KakaoUserInfo
    
    // 카카오 API 응답을 파일로 저장 (개발 환경에서만, 필요시 활성화)
    // if (process.env.NODE_ENV === 'development' && process.env.DEBUG_KAKAO === 'true') {
    //   try {
    //     const fs = await import('fs')
    //     const path = await import('path')
    //     const debugDir = path.join(process.cwd(), 'debug')
    //     if (!fs.existsSync(debugDir)) {
    //       fs.mkdirSync(debugDir, { recursive: true })
    //     }
    //     const debugFile = path.join(debugDir, `kakao_response_${Date.now()}.json`)
    //     fs.writeFileSync(debugFile, JSON.stringify(userInfo, null, 2), 'utf-8')
    //     console.log(`카카오 API 응답이 저장되었습니다: ${debugFile}`)
    //   } catch (err) {
    //     console.error('디버그 파일 저장 실패:', err)
    //   }
    // }
    
    // 강제로 로그 출력
    process.stdout.write('\n=== 카카오 사용자 정보 응답 ===\n')
    process.stdout.write(`사용자 정보 전체: ${JSON.stringify(userInfo, null, 2)}\n`)
    process.stdout.write('=== 응답 분석 시작 ===\n\n')
    
    console.log('=== 카카오 사용자 정보 응답 ===')
    console.log('사용자 정보 전체:', JSON.stringify(userInfo, null, 2))
    console.log('=== 응답 분석 시작 ===')

    const kakaoId = userInfo.id?.toString()
    if (!kakaoId) {
      console.error('카카오 ID를 가져올 수 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
    }

    // 디버깅을 위한 상세 로그
    console.log('=== 카카오 사용자 정보 구조 분석 ===')
    console.log('hasKakaoAccount:', !!userInfo.kakao_account)
    console.log('hasProperties:', !!userInfo.properties)
    if (userInfo.kakao_account) {
      console.log('kakao_account 키들:', Object.keys(userInfo.kakao_account))
      console.log('kakao_account 전체:', JSON.stringify(userInfo.kakao_account, null, 2))
      if (userInfo.kakao_account.profile) {
        console.log('kakao_account.profile 키들:', Object.keys(userInfo.kakao_account.profile))
        console.log('kakao_account.profile 전체:', JSON.stringify(userInfo.kakao_account.profile, null, 2))
      } else {
        console.log('⚠️ kakao_account.profile이 없습니다!')
      }
    } else {
      console.log('⚠️ kakao_account가 없습니다!')
    }
    if (userInfo.properties) {
      console.log('properties 키들:', Object.keys(userInfo.properties))
      console.log('properties 전체:', JSON.stringify(userInfo.properties, null, 2))
    } else {
      console.log('⚠️ properties가 없습니다!')
    }
    console.log('=== 구조 분석 완료 ===')

    const emailFromKakao = userInfo.kakao_account?.email
    // 이메일이 없으면 카카오 ID 기반으로 가짜 이메일 생성 (DB NOT NULL 제약조건 때문)
    const email = emailFromKakao || `kakao_${kakaoId}@kakao.local`
    
    // 이름 추출 - 모든 가능한 경로 시도
    let name = null
    
    // 디버깅: 모든 가능한 닉네임 경로 확인
    const possibleNicknames = {
      'kakao_account.profile.nickname': userInfo.kakao_account?.profile?.nickname,
      'kakao_account.profile.nickName': userInfo.kakao_account?.profile?.nickName,
      'kakao_account.name': userInfo.kakao_account?.name,
      'properties.nickname': userInfo.properties?.nickname,
      'properties.nickName': userInfo.properties?.nickName,
      'properties.name': userInfo.properties?.name,
      'kakao_account.profile': userInfo.kakao_account?.profile,
      'properties': userInfo.properties,
    }
    
    // 1. kakao_account.profile.nickname (가장 일반적)
    if (userInfo.kakao_account?.profile?.nickname) {
      name = userInfo.kakao_account.profile.nickname
    }
    // 2. kakao_account.profile.nickName (대소문자 차이)
    else if (userInfo.kakao_account?.profile?.nickName) {
      name = userInfo.kakao_account.profile.nickName
    }
    // 3. properties.nickname
    else if (userInfo.properties?.nickname) {
      name = userInfo.properties.nickname
    }
    // 4. properties.nickName (대소문자 차이)
    else if (userInfo.properties?.nickName) {
      name = userInfo.properties.nickName
    }
    // 5. kakao_account.name
    else if (userInfo.kakao_account?.name) {
      name = userInfo.kakao_account.name
    }
    // 6. properties.name
    else if (userInfo.properties?.name) {
      name = userInfo.properties.name
    }
    // 7. profile 객체에서 직접 추출 시도
    else if (userInfo.kakao_account?.profile) {
      const profile = userInfo.kakao_account.profile
      // profile 객체의 모든 키 확인
      const profileKeys = Object.keys(profile)
      for (const key of profileKeys) {
        if (key.toLowerCase().includes('nick') || key.toLowerCase().includes('name')) {
          const value = (profile as any)[key]
          if (typeof value === 'string' && value.trim()) {
            name = value
            break
          }
        }
      }
    }
    // 8. properties 객체에서 직접 추출 시도
    else if (userInfo.properties) {
      const props = userInfo.properties
      const propKeys = Object.keys(props)
      for (const key of propKeys) {
        if (key.toLowerCase().includes('nick') || key.toLowerCase().includes('name')) {
          const value = (props as any)[key]
          if (typeof value === 'string' && value.trim()) {
            name = value
            break
          }
        }
      }
    }
    
    // 최종적으로 닉네임이 없으면 카카오 ID 기반으로 생성
    // 하지만 실제로는 카카오 계정에 닉네임이 설정되어 있어야 함
    if (!name || name.trim() === '') {
      // 카카오 ID의 마지막 6자리 사용
      name = `카카오${kakaoId.slice(-6)}`
      
      // 경고: 닉네임을 찾을 수 없음
      console.error('❌❌❌ 닉네임을 찾을 수 없습니다! ❌❌❌')
      console.error('카카오 API 응답 구조를 확인하세요.')
      console.error('디버그 파일을 확인하거나, 카카오 개발자 콘솔 설정을 확인하세요.')
    } else {
      console.log('✅✅✅ 닉네임 추출 성공:', name)
    }
    
    // 프로필 이미지 추출
    const picture = userInfo.kakao_account?.profile?.profile_image_url || 
                    userInfo.properties?.profile_image ||
                    userInfo.kakao_account?.profile_image

    // 닉네임 추출 결과 로깅
    console.log('\n=== 닉네임 추출 결과 ===')
    console.log('추출된 닉네임:', name)
    console.log('가능한 닉네임 경로들:', JSON.stringify(possibleNicknames, null, 2))
    console.log('=== 닉네임 추출 완료 ===\n')
    
    console.log('추출된 사용자 정보:', {
      kakaoId,
      email,
      emailFromKakao: emailFromKakao || '(카카오에서 제공 안 함)',
      name,
    })

    // 카카오 Provider 찾기 또는 생성
    console.log('OAuth Provider 찾기/생성 시작...')
    const provider = await OAuthProviderModel.findOrCreate('kakao', 'Kakao')
    console.log('OAuth Provider ID:', provider.id)

        // 기존 OAuth 연결 확인
        console.log('기존 OAuth 연결 확인 중...')
        let oauthConnection = await UserOAuthModel.findByOAuthUserId(provider.id, kakaoId)
        let user
        let isNewUser = false

        if (oauthConnection) {
      console.log('기존 OAuth 연결 발견, 사용자 ID:', oauthConnection.user_id)
      // 기존 사용자 - 로그인
      user = await UserModel.findById(oauthConnection.user_id)
      if (!user) {
        console.error('OAuth 연결은 있지만 사용자를 찾을 수 없음:', oauthConnection.user_id)
        return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=user_not_found`)
      }

      // 기존 사용자의 이름을 카카오 닉네임으로 업데이트 (변경된 경우)
      if (name && name !== user.name && name.trim() !== '') {
        console.log('기존 사용자 이름 업데이트:', user.name, '->', name)
        const connection = await pool.getConnection()
        try {
          await connection.execute(
            'UPDATE users SET name = ? WHERE id = ?',
            [name, user.id]
          )
          connection.release()
          // 업데이트된 사용자 정보 다시 가져오기
          user = await UserModel.findById(user.id)
          if (!user) {
            throw new Error('사용자 정보 업데이트 후 조회 실패')
          }
          console.log('사용자 이름 업데이트 완료')
        } catch (error) {
          connection.release()
          console.error('사용자 이름 업데이트 중 오류:', error)
          // 업데이트 실패해도 로그인은 계속 진행
        }
      }

      // 마지막 로그인 시간 업데이트
      await UserOAuthModel.updateLastLogin(oauthConnection.id)
      console.log('기존 사용자 로그인 성공')
    } else {
      console.log('새 OAuth 연결, 사용자 생성/연결 시작...')
      // 새 사용자 - 회원가입 또는 기존 이메일과 연결
      // 실제 카카오 이메일이 있으면 그것으로 검색, 없으면 생성된 이메일로 검색
      const searchEmail = emailFromKakao || email
      
      // is_verified = true인 이메일이 이미 존재하는지 확인 (중복 가입 방지)
      const emailExists = await UserModel.isEmailExists(searchEmail)
      if (emailExists) {
        console.error('이미 가입된 이메일입니다:', searchEmail)
        return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=email_already_exists`)
      }
      
      user = await UserModel.findByEmail(searchEmail)
      console.log('이메일로 기존 사용자 검색:', searchEmail, user ? '발견' : '없음')

      if (!user) {
        // 새 사용자 생성
        console.log('새 사용자 생성 시작...')
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          console.log('트랜잭션 시작')

          // users 테이블에 사용자 생성 (이메일은 항상 있음 - 없으면 kakao_{id}@kakao.local 형식으로 생성)
          const [result] = await connection.execute(
            `INSERT INTO users (email, name, status, is_verified) 
             VALUES (?, ?, 'active', true)`,
            [email, name]
          )

          const insertResult = result as { insertId: number }
          const userId = insertResult.insertId
          console.log('새 사용자 생성 완료, ID:', userId)

          // OAuth 연결 생성 (트랜잭션 내에서 같은 연결 사용)
          const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
          await connection.execute(
            `INSERT INTO user_oauth_connections 
             (user_id, provider_id, oauth_user_id, email_at_signup, access_token_enc, refresh_token_enc, expires_at, last_login_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              userId,
              provider.id,
              kakaoId,
              emailFromKakao || null, // 실제 카카오 이메일만 저장 (없으면 null)
              accessToken,
              refreshToken || null,
              expiresAt,
            ]
          )
          console.log('OAuth 연결 생성 완료')

          await connection.commit()
          connection.release()
          console.log('트랜잭션 커밋 완료')

          user = await UserModel.findById(userId)
          if (!user) {
            throw new Error('사용자 생성 후 조회 실패')
          }
          isNewUser = true // 새 사용자 플래그 설정
          console.log('새 사용자 생성 및 로그인 성공')
        } catch (error) {
          await connection.rollback()
          connection.release()
          console.error('새 사용자 생성 중 오류:', error)
          throw error
        }
      } else {
        // 기존 사용자 - OAuth 연결 추가
        console.log('기존 사용자에 OAuth 연결 추가...')
        const connection = await pool.getConnection()
        try {
          await connection.beginTransaction()
          
          const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
          await connection.execute(
            `INSERT INTO user_oauth_connections 
             (user_id, provider_id, oauth_user_id, email_at_signup, access_token_enc, refresh_token_enc, expires_at, last_login_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              user.id,
              provider.id,
              kakaoId,
              emailFromKakao || null, // 실제 카카오 이메일만 저장 (없으면 null)
              accessToken,
              refreshToken || null,
              expiresAt,
            ]
          )
          
          await connection.commit()
          connection.release()
          console.log('기존 사용자에 OAuth 연결 추가 완료')
        } catch (error) {
          await connection.rollback()
          connection.release()
          console.error('OAuth 연결 추가 중 오류:', error)
          throw error
        }
      }
    }

    // JWT 토큰 생성
    console.log('JWT 토큰 생성 시작...')
    const jwtSecret = process.env.JWT_SECRET
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'

    if (!jwtSecret) {
      console.error('JWT_SECRET이 설정되지 않았습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=server_error`)
    }

    if (!user) {
      console.error('사용자 정보가 없습니다')
      return res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=user_not_found`)
    }

    const jwtAccessToken = jwt.sign(
      { userId: user.id }, 
      jwtSecret as string, 
      { expiresIn: jwtExpiresIn } as SignOptions
    )
    console.log('JWT 토큰 생성 완료')

    // 리프레시 토큰 생성
    console.log('리프레시 토큰 생성 시작...')
    const deviceInfo = req.headers['user-agent'] || undefined
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress || 
               undefined
    const refreshTokenJWT = await SessionTokenModel.create(user.id, deviceInfo, ip)
    console.log('리프레시 토큰 생성 완료')

    // 프론트엔드로 리다이렉트 (토큰을 쿼리 파라미터로 전달)
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173'
    let redirectUrl = `${frontendUrl}/auth/callback?token=${jwtAccessToken}&refreshToken=${refreshTokenJWT}`
    if (isNewUser) {
      redirectUrl += '&isNewUser=true'
    }
    console.log('프론트엔드로 리다이렉트:', redirectUrl)
    res.redirect(redirectUrl)
  } catch (error: any) {
    console.error('카카오 OAuth 콜백 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    res.redirect(`${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login?error=oauth_failed`)
  }
})

export default router

