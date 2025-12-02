import { useState, useEffect } from 'react'

/**
 * 미디어 쿼리를 감지하는 커스텀 훅
 * @param query 미디어 쿼리 문자열 (예: '(min-width: 768px)')
 * @returns 쿼리가 일치하는지 여부
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    // 초기값 설정
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    // 리스너 함수
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // 이벤트 리스너 등록 (addEventListener가 지원되는 경우)
    if (media.addEventListener) {
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    } else {
      // 구형 브라우저 지원 (addListener 사용)
      media.addListener(listener)
      return () => media.removeListener(listener)
    }
  }, [matches, query])

  return matches
}

/**
 * 모바일 화면인지 확인하는 훅 (768px 미만)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/**
 * 데스크톱 화면인지 확인하는 훅 (768px 이상)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

