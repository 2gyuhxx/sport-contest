import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// Custom Hook: AuthContext 사용
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext는 AuthProvider 내에서만 사용할 수 있습니다')
  }
  return context
}

