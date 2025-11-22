import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services/AuthService'
import { useAuthContext } from '../context/useAuthContext'
import { TestTube, User, Shield, LogIn } from 'lucide-react'

// 테스트 계정 목록
const TEST_ACCOUNTS = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: '관리자',
    role: '관리자',
    description: '모든 권한, 행사 생성/수정/삭제 가능',
    color: 'bg-red-500 hover:bg-red-600',
  },
  {
    email: 'user1@test.com',
    password: 'user123',
    name: '일반사용자1',
    role: '일반 사용자',
    description: '행사 조회, 관심 종목 설정',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    email: 'user2@test.com',
    password: 'user123',
    name: '일반사용자2',
    role: '일반 사용자',
    description: '행사 조회, 관심 종목 설정',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    email: 'organizer@test.com',
    password: 'org123',
    name: '행사주최자',
    role: '행사 주최자',
    description: '행사 생성/수정/삭제 가능',
    color: 'bg-green-500 hover:bg-green-600',
  },
]

export function DevTestPage() {
  const navigate = useNavigate()
  const { dispatch } = useAuthContext()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleQuickLogin = async (email: string, password: string) => {
    setIsLoading(email)
    setMessage(null)

    try {
      const user = await AuthService.login({ email, password })
      dispatch({ type: 'LOGIN', payload: user })
      setMessage('✅ 로그인 성공! 홈으로 이동합니다...')
      setTimeout(() => {
        navigate('/')
      }, 1000)
    } catch (err) {
      setMessage(`❌ 로그인 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
            <TestTube className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">🧪 개발자 테스트 페이지</h1>
          <p className="mt-2 text-sm text-slate-600">
            모든 기능을 테스트할 수 있는 테스트 계정으로 빠르게 로그인하세요
          </p>
        </div>

        {/* 메시지 */}
        {message && (
          <div className={`mb-6 rounded-lg p-4 text-sm ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* 테스트 계정 카드들 */}
        <div className="grid gap-4 md:grid-cols-2">
          {TEST_ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {account.role === '관리자' || account.role === '행사 주최자' ? (
                      <Shield className="h-5 w-5 text-amber-500" />
                    ) : (
                      <User className="h-5 w-5 text-blue-500" />
                    )}
                    <h3 className="text-lg font-bold text-slate-900">{account.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{account.role}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${
                  account.role === '관리자' ? 'bg-red-500' :
                  account.role === '행사 주최자' ? 'bg-green-500' :
                  'bg-blue-500'
                }`}>
                  {account.role === '관리자' ? 'ADMIN' :
                   account.role === '행사 주최자' ? 'ORGANIZER' :
                   'USER'}
                </span>
              </div>

              <p className="mb-4 text-sm text-slate-600">{account.description}</p>

              <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-700">계정 정보</div>
                <div className="mt-1 space-y-1 text-slate-600">
                  <div>이메일: <code className="bg-white px-1 rounded">{account.email}</code></div>
                  <div>비밀번호: <code className="bg-white px-1 rounded">{account.password}</code></div>
                </div>
              </div>

              <button
                onClick={() => handleQuickLogin(account.email, account.password)}
                disabled={isLoading !== null}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${account.color}`}
              >
                {isLoading === account.email ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    로그인 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="h-4 w-4" />
                    빠른 로그인
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div className="mt-8 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
            <TestTube className="h-5 w-5" />
            테스트 계정 생성 방법
          </h3>
          <div className="space-y-2 text-sm text-amber-800">
            <p>서버에서 다음 명령어를 실행하여 테스트 계정을 생성하세요:</p>
            <code className="block rounded bg-amber-100 p-3 font-mono text-xs">
              cd ~/sport-contest/server<br />
              node scripts/createTestAccounts.js
            </code>
            <p className="mt-3 text-xs">
              💡 이 페이지는 일반 사용자에게는 보이지 않습니다. URL을 직접 입력하여 접근하세요.
            </p>
          </div>
        </div>

        {/* 홈으로 돌아가기 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}

