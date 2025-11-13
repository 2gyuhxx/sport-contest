// 사용자 역할 타입
export type UserRole = 'user' | 'organizer'

// 스포츠 카테고리 타입
export type SportCategory = 'football' | 'basketball' | 'baseball' | 'volleyball' | 'marathon' | 'fitness' | 'esports'

// 사용자 정보 타입
export interface User {
  id: string
  email: string
  name: string
  role: UserRole // 사용자 역할 (일반 사용자 또는 행사 관리자)
  interests?: SportCategory[] // 관심 있는 체육 종목 (일반 사용자만 해당)
  createdAt: string
}

// 로그인 요청 타입
export interface LoginCredentials {
  email: string
  password: string
}

// 회원가입 요청 타입
export interface SignupData {
  email: string
  password: string
  name: string
  role: UserRole // 사용자 역할
  interests?: SportCategory[] // 관심 종목 (일반 사용자인 경우)
}

// 인증 상태 타입
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

