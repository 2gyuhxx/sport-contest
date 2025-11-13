import type { LoginCredentials, SignupData, User } from '../types/auth'

// Mock 사용자 데이터베이스 (실제 프로젝트에서는 백엔드 API 호출)
const MOCK_USERS_KEY = 'sportable_mock_users'

// Mock 사용자 목록 가져오기
function getMockUsers(): User[] {
  const stored = localStorage.getItem(MOCK_USERS_KEY)
  if (!stored) return []
  try {
    return JSON.parse(stored) as User[]
  } catch {
    return []
  }
}

// Mock 사용자 목록 저장
function saveMockUsers(users: User[]): void {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
}

// 비밀번호 저장 (Mock용 - 실제로는 해싱 필요)
function getPasswordStore(): Record<string, string> {
  const stored = localStorage.getItem('sportable_passwords')
  if (!stored) return {}
  try {
    return JSON.parse(stored) as Record<string, string>
  } catch {
    return {}
  }
}

function savePassword(userId: string, password: string): void {
  const store = getPasswordStore()
  store[userId] = password
  localStorage.setItem('sportable_passwords', JSON.stringify(store))
}

function verifyPassword(userId: string, password: string): boolean {
  const store = getPasswordStore()
  return store[userId] === password
}

// 이메일 중복 검사
function isEmailExists(email: string): boolean {
  const users = getMockUsers()
  return users.some((user) => user.email === email)
}

// 이메일 유효성 검사
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 비밀번호 유효성 검사 (최소 6자)
function isValidPassword(password: string): boolean {
  return password.length >= 6
}

export const AuthService = {
  /**
   * 로그인
   */
  async login(credentials: LoginCredentials): Promise<User> {
    // 네트워크 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 800))

    const { email, password } = credentials

    // 입력 검증
    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 입력해주세요')
    }

    // 사용자 찾기
    const users = getMockUsers()
    const user = users.find((u) => u.email === email)

    if (!user) {
      throw new Error('등록되지 않은 이메일입니다')
    }

    // 비밀번호 확인
    if (!verifyPassword(user.id, password)) {
      throw new Error('비밀번호가 일치하지 않습니다')
    }

    // 로그인 성공 - localStorage에 저장
    localStorage.setItem('sportable_user', JSON.stringify(user))

    return user
  },

  /**
   * 회원가입
   */
  async signup(data: SignupData): Promise<User> {
    // 네트워크 지연 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const { email, password, name, role, interests } = data

    // 입력 검증
    if (!email || !password || !name) {
      throw new Error('모든 필드를 입력해주세요')
    }

    if (!role) {
      throw new Error('사용자 유형을 선택해주세요')
    }

    if (!isValidEmail(email)) {
      throw new Error('유효한 이메일 주소를 입력해주세요')
    }

    if (!isValidPassword(password)) {
      throw new Error('비밀번호는 최소 6자 이상이어야 합니다')
    }

    if (name.length < 2) {
      throw new Error('이름은 최소 2자 이상이어야 합니다')
    }

    // 일반 사용자인 경우 관심 종목 필수
    if (role === 'user' && (!interests || interests.length === 0)) {
      throw new Error('관심 있는 체육 종목을 최소 1개 이상 선택해주세요')
    }

    // 이메일 중복 검사
    if (isEmailExists(email)) {
      throw new Error('이미 사용 중인 이메일입니다')
    }

    // 새 사용자 생성
    const newUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      email,
      name,
      role,
      interests: role === 'user' ? interests : undefined, // 일반 사용자만 관심 종목 저장
      createdAt: new Date().toISOString(),
    }

    // 사용자 목록에 추가
    const users = getMockUsers()
    users.push(newUser)
    saveMockUsers(users)

    // 비밀번호 저장
    savePassword(newUser.id, password)

    // 자동 로그인
    localStorage.setItem('sportable_user', JSON.stringify(newUser))

    return newUser
  },

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300))
    localStorage.removeItem('sportable_user')
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
}

