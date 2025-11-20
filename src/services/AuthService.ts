import type { LoginCredentials, SignupData, User } from '../types/auth'
import type { Category } from '../types/events'
import { categoryMap } from './EventService'
import apiRequest from '../config/api'

// API 응답 타입
interface LoginResponse {
  user: {
    id: number
    email: string
    name: string | null
    phone: string | null
    sports: string | null
    manager: boolean
    is_verified: boolean
    created_at: string
  }
  accessToken: string
  refreshToken: string
}

interface UserResponse {
  user: {
    id: number
    email: string
    name: string | null
    phone: string | null
    sports: string | null
    manager: boolean
    is_verified: boolean
    created_at: string
  }
}

// DB User를 프론트엔드 User 타입으로 변환
function transformUser(dbUser: LoginResponse['user'] | UserResponse['user']): User {
  // MySQL에서 boolean이 0/1로 반환될 수 있으므로 명시적으로 boolean으로 변환
  const manager = Boolean(dbUser.manager)
  
  // 한글 스포츠 이름을 카테고리 ID로 변환
  let interests: Category[] | undefined = undefined
  if (dbUser.sports) {
    const sportNames = dbUser.sports.split(',').map(s => s.trim())
    const categoryIds = sportNames
      .map(name => categoryMap[name])
      .filter((category): category is Category => category !== undefined)
    
    if (categoryIds.length > 0) {
      interests = categoryIds
    }
  }
  
  return {
    id: dbUser.id.toString(),
    email: dbUser.email,
    name: dbUser.name || '',
    role: manager ? 'organizer' : 'user',
    manager: manager, // manager 필드 직접 포함 (명시적 boolean 변환)
    interests,
    createdAt: dbUser.created_at,
  }
}

export const AuthService = {
  /**
   * 로그인
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const { email, password } = credentials

    // 입력 검증
    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 입력해주세요')
    }

    try {
      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      // 토큰 저장
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)

      // 사용자 정보 변환 및 저장
      const user = transformUser(response.user)
      localStorage.setItem('sportable_user', JSON.stringify(user))

      return user
    } catch (error) {
      throw error
    }
  },

  /**
   * 회원가입
   */
  async signup(data: SignupData): Promise<User> {
    const { email, password, name, role, interests } = data

    // 입력 검증
    if (!email || !password || !name) {
      throw new Error('모든 필드를 입력해주세요')
    }

    if (!role) {
      throw new Error('사용자 유형을 선택해주세요')
    }

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('유효한 이메일 주소를 입력해주세요')
    }

    // 비밀번호 유효성 검사
    if (password.length < 6) {
      throw new Error('비밀번호는 최소 6자 이상이어야 합니다')
    }

    if (name.length < 2) {
      throw new Error('이름은 최소 2자 이상이어야 합니다')
    }

    // 일반 사용자인 경우 관심 종목 필수
    if (role === 'user' && (!interests || interests.length === 0)) {
      throw new Error('관심 있는 체육 종목을 최소 1개 이상 선택해주세요')
    }

    try {
      // 회원가입 API 호출
      const sportsValue = interests && interests.length > 0 ? interests.join(',') : null

      const response = await apiRequest<LoginResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          manager: role === 'organizer',
          sports: sportsValue,
        }),
      })

      // 토큰 저장
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)

      // 사용자 정보 변환 및 저장
      const user = transformUser(response.user)
      localStorage.setItem('sportable_user', JSON.stringify(user))

      return user
    } catch (error) {
      throw error
    }
  },

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken')
    
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        })
      }
    } catch (error) {
      console.error('로그아웃 API 오류:', error)
      // API 오류가 있어도 로컬 스토리지는 정리
    } finally {
      localStorage.removeItem('sportable_user')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  },

  /**
   * 현재 로그인된 사용자 가져오기
   */
  getCurrentUser(): User | null {
    const stored = localStorage.getItem('sportable_user')
    if (!stored) return null
    try {
      return JSON.parse(stored) as User
    } catch {
      return null
    }
  },

  /**
   * 토큰 갱신
   */
  async refreshToken(): Promise<User | null> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      return null
    }

    try {
      const response = await apiRequest<{ user: UserResponse['user']; accessToken: string }>(
        '/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }
      )

      // 새 토큰 저장
      localStorage.setItem('accessToken', response.accessToken)

      // 사용자 정보 변환 및 저장
      const user = transformUser(response.user)
      localStorage.setItem('sportable_user', JSON.stringify(user))

      return user
    } catch (error) {
      // 리프레시 토큰이 만료된 경우 로그아웃 처리
      this.logout()
      return null
    }
  },

  /**
   * 현재 사용자 정보 서버에서 가져오기
   */
  async getCurrentUserFromServer(): Promise<User | null> {
    try {
      const response = await apiRequest<UserResponse>('/auth/me')
      const user = transformUser(response.user)
      localStorage.setItem('sportable_user', JSON.stringify(user))
      return user
    } catch (error) {
      // 토큰이 만료된 경우 리프레시 시도
      const refreshed = await this.refreshToken()
      if (refreshed) {
        return refreshed
      }
      return null
    }
  },

  /**
   * 사용자 정보 업데이트 (소셜 로그인 후 추가 정보 입력용)
   */
  async updateUserInfo(data: { manager?: boolean; sports?: string | null }): Promise<User> {
    try {
      const response = await apiRequest<UserResponse>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })

      // 사용자 정보 변환 및 저장
      const user = transformUser(response.user)
      localStorage.setItem('sportable_user', JSON.stringify(user))

      return user
    } catch (error) {
      throw error
    }
  },

  /**
   * 회원탈퇴
   */
  async deleteAccount(): Promise<void> {
    try {
      await apiRequest<{ message: string }>('/auth/me', {
        method: 'DELETE',
      })

      // 로컬 스토리지 정리
      localStorage.removeItem('sportable_user')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    } catch (error) {
      throw error
    }
  },
}

