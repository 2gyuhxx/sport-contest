// API 기본 URL 설정
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

// API 요청 헬퍼 함수
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  // 토큰 가져오기
  const token = localStorage.getItem('accessToken')
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '요청에 실패했습니다' }))
      console.error('API 오류:', {
        status: response.status,
        statusText: response.statusText,
        error,
        url,
      })
      
      // 403 에러 (유효하지 않은 토큰)인 경우 토큰 갱신 시도
      if (response.status === 403 && error.error?.includes('토큰')) {
        const { AuthService } = await import('../services/AuthService')
        const refreshed = await AuthService.refreshToken()
        if (refreshed) {
          // 토큰 갱신 성공 시 재시도
          const newToken = localStorage.getItem('accessToken')
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            })
            if (retryResponse.ok) {
              return retryResponse.json()
            }
          }
        }
      }
      
      throw new Error(error.error || `요청에 실패했습니다 (${response.status})`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('네트워크 오류:', error)
      throw new Error('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
    }
    throw error
  }
}

export default apiRequest

