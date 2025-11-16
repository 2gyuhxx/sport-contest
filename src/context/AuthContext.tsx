import { createContext, useReducer, useEffect, type ReactNode } from 'react'
import type { User, AuthState } from '../types/auth'
import { AuthService } from '../services/AuthService'

// Action 타입 정의
type AuthAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESTORE_USER'; payload: User | null }

// Context 타입
interface AuthContextType {
  state: AuthState
  dispatch: React.Dispatch<AuthAction>
}

// 초기 상태
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // 앱 시작 시 localStorage에서 사용자 정보 복원 중
}

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      }
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    case 'RESTORE_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      }
    default:
      return state
  }
}

// Context 생성
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider 컴포넌트
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // 앱 시작 시 localStorage에서 사용자 정보 복원
  useEffect(() => {
    const storedUser = localStorage.getItem('sportable_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as User
        // manager 필드가 없는 경우 서버에서 최신 정보 가져오기
        if (user.manager === undefined) {
          AuthService.getCurrentUserFromServer()
            .then((latestUser) => {
              if (latestUser) {
                dispatch({ type: 'RESTORE_USER', payload: latestUser })
              } else {
                dispatch({ type: 'RESTORE_USER', payload: null })
              }
            })
            .catch(() => {
              dispatch({ type: 'RESTORE_USER', payload: null })
            })
        } else {
          dispatch({ type: 'RESTORE_USER', payload: user })
        }
      } catch (error) {
        console.error('사용자 정보 복원 실패:', error)
        localStorage.removeItem('sportable_user')
        dispatch({ type: 'RESTORE_USER', payload: null })
      }
    } else {
      dispatch({ type: 'RESTORE_USER', payload: null })
    }
  }, [])

  return <AuthContext.Provider value={{ state, dispatch }}>{children}</AuthContext.Provider>
}

