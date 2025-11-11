import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import { useAuthContext } from '../context/useAuthContext'
import { AuthService } from '../services/AuthService'

export function LoginPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // 로그인 시도
      const user = await AuthService.login({ email, password })

      // Context에 사용자 정보 저장
      dispatch({ type: 'LOGIN', payload: user })

      // 홈으로 이동
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-300px)] items-center justify-center">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary">
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">로그인</h1>
          <p className="mt-2 text-sm text-slate-600">
            스포터블에 오신 것을 환영합니다
          </p>
        </div>

        {/* 로그인 폼 */}
        <div className="rounded-3xl border border-surface-subtle bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-lg border border-surface-subtle bg-surface px-10 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-6 text-center text-sm text-slate-600">
            아직 계정이 없으신가요?{' '}
            <Link to="/signup" className="font-semibold text-brand-primary hover:underline">
              회원가입
            </Link>
          </div>
        </div>

        {/* 데모 안내 */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-semibold">💡 데모 안내</p>
          <p className="mt-1 text-xs">
            회원가입 후 로그인하시거나, 임의의 이메일과 비밀번호로 테스트해보세요.
            (데이터는 브라우저 localStorage에 저장됩니다)
          </p>
        </div>
      </div>
    </div>
  )
}

