import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'
import type { User } from '../types/auth'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const refreshToken = searchParams.get('refreshToken')

    if (token && refreshToken) {
      // 토큰 저장
      localStorage.setItem('accessToken', token)
      localStorage.setItem('refreshToken', refreshToken)

      // 사용자 정보 가져오기
      AuthService.getCurrentUserFromServer()
        .then((user: User | null) => {
          if (user) {
            dispatch({ type: 'LOGIN', payload: user })
            navigate('/')
          } else {
            navigate('/login?error=user_not_found')
          }
        })
        .catch(() => {
          navigate('/login?error=oauth_failed')
        })
    } else {
      navigate('/login?error=oauth_failed')
    }
  }, [searchParams, navigate, dispatch])

  return (
    <div className="flex min-h-[calc(100vh-300px)] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
        <p className="text-sm text-slate-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}

