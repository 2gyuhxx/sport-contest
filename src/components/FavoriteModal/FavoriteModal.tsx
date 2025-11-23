import { memo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface FavoriteModalProps {
  isOpen: boolean
  message: string
  onClose: () => void
}

export const FavoriteModal = memo(function FavoriteModal({
  isOpen,
  message,
  onClose,
}: FavoriteModalProps) {
  if (!isOpen) return null

  const isError = message.includes('실패') || message.includes('로그인')
  const title = isError ? '알림' : '완료'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm transform rounded-2xl bg-white shadow-xl transition-all">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isError ? 'bg-red-100' : 'bg-green-100'
              }`}
            >
              {isError ? (
                <XCircle className="h-6 w-6 text-red-600" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">{message}</p>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary py-3 font-semibold text-white transition hover:opacity-90"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
})

