const formatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/**
 * 날짜 문자열을 포맷팅
 * 타임존 문제를 해결하기 위해 날짜 부분만 추출하여 로컬 시간대로 파싱
 */
export function formatDate(isoDate: string) {
  // 날짜 부분만 추출 (YYYY-MM-DD)
  let dateOnly = isoDate
  
  // ISO 형식(YYYY-MM-DDTHH:mm:ss)인 경우 날짜 부분만 추출
  if (isoDate.includes('T')) {
    dateOnly = isoDate.split('T')[0]
  }
  // 공백으로 구분된 형식(YYYY-MM-DD HH:mm:ss)인 경우
  else if (isoDate.includes(' ')) {
    dateOnly = isoDate.split(' ')[0]
  }
  
  // YYYY-MM-DD 형식인 경우 로컬 시간대로 파싱 (타임존 문제 해결)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split('-').map(Number)
    // 로컬 시간대로 Date 객체 생성 (월은 0부터 시작하므로 -1)
    const date = new Date(year, month - 1, day)
    return formatter.format(date)
  }
  
  // 다른 형식인 경우 기존 방식 사용 (fallback)
  return formatter.format(new Date(isoDate))
}
