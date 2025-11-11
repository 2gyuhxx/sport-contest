// 사용자 정보 타입
export interface User {
  id: string
  email: string
  name: string
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
}

// 인증 상태 타입
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

