import { useState } from 'react'
import { Eye, EyeOff, Database, Trash2 } from 'lucide-react'

/**
 * 개발용 디버그 패널 - localStorage 데이터 확인 및 관리
 * 프로덕션 빌드에서는 제거할 것
 */
export function DevDebugPanel() {
  const [isOpen, setIsOpen] = useState(false)

  const currentUser = localStorage.getItem('sportable_user')
  const mockUsers = localStorage.getItem('sportable_mock_users')
  const passwords = localStorage.getItem('sportable_passwords')

  const clearAll = () => {
    if (window.confirm('모든 사용자 데이터를 삭제하시겠습니까?')) {
      localStorage.removeItem('sportable_user')
      localStorage.removeItem('sportable_mock_users')
      localStorage.removeItem('sportable_passwords')
      window.location.reload()
    }
  }

  const clearSession = () => {
    if (window.confirm('현재 로그인 세션을 삭제하시겠습니까?')) {
      localStorage.removeItem('sportable_user')
      window.location.reload()
    }
  }

  if (import.meta.env.MODE === 'production') {
    return null // 프로덕션에서는 숨김
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="w-96 rounded-2xl border border-slate-300 bg-white shadow-2xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">개발자 디버그 패널</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 transition hover:bg-slate-200"
            >
              <EyeOff className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          {/* 내용 */}
          <div className="max-h-96 overflow-y-auto p-4">
            {/* 현재 로그인 사용자 */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-slate-500">
                  현재 로그인 사용자
                </h4>
                {currentUser && (
                  <button
                    onClick={clearSession}
                    className="rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                  >
                    세션 삭제
                  </button>
                )}
              </div>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-green-400">
                {currentUser ? JSON.stringify(JSON.parse(currentUser), null, 2) : 'null'}
              </pre>
            </div>

            {/* 전체 회원 목록 */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                전체 회원 목록 ({mockUsers ? JSON.parse(mockUsers).length : 0}명)
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-green-400">
                {mockUsers ? JSON.stringify(JSON.parse(mockUsers), null, 2) : '[]'}
              </pre>
            </div>

            {/* 비밀번호 저장소 */}
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                비밀번호 저장소 (평문 - 개발용)
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-yellow-400">
                {passwords ? JSON.stringify(JSON.parse(passwords), null, 2) : '{}'}
              </pre>
            </div>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <button
              onClick={clearAll}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              모든 데이터 삭제
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              ⚠️ 이 패널은 개발 모드에서만 표시됩니다
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
        >
          <Eye className="h-4 w-4" />
          디버그 패널
        </button>
      )}
    </div>
  )
}

