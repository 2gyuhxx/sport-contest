const formatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const shortFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric',
  day: 'numeric',
})

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 정규화
 * 다양한 날짜 형식(ISO, 공백 구분 등)을 처리
 */
export function normalizeDateToYYYYMMDD(dateString: string): string {
  if (!dateString) return ''
  
  // ISO 형식(YYYY-MM-DDTHH:mm:ss)인 경우 날짜 부분만 추출
  if (dateString.includes('T')) {
    return dateString.split('T')[0]
  }
  
  // 공백으로 구분된 형식(YYYY-MM-DD HH:mm:ss)인 경우
  if (dateString.includes(' ')) {
    return dateString.split(' ')[0]
  }
  
  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  
  // 다른 형식인 경우 Date 객체로 파싱 (fallback)
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return ''
  }
  
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 날짜 문자열을 포맷팅
 * 타임존 문제를 해결하기 위해 날짜 부분만 추출하여 로컬 시간대로 파싱
 */
export function formatDate(isoDate: string): string {
  const dateOnly = normalizeDateToYYYYMMDD(isoDate)
  
  if (!dateOnly) {
    return ''
  }
  
  // YYYY-MM-DD 형식인 경우 로컬 시간대로 파싱 (타임존 문제 해결)
    const [year, month, day] = dateOnly.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return formatter.format(date)
}

/**
 * 짧은 날짜 포맷 (모바일용)
 * 예: "11월 29일" 또는 "11. 29"
 */
export function formatDateShort(isoDate: string): string {
  const dateOnly = normalizeDateToYYYYMMDD(isoDate)
  
  if (!dateOnly) {
    return ''
  }
  
  // YYYY-MM-DD 형식인 경우 로컬 시간대로 파싱
    const [year, month, day] = dateOnly.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return shortFormatter.format(date)
  }
  
