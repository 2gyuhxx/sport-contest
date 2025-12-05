import type { Category } from '../types/events'

// 스포츠 카테고리 정보
export const SPORT_CATEGORIES: { value: Category; label: string; emoji: string }[] = [
    { value: 'team-ball', label: '구기·팀', emoji: '⚽' },
    { value: 'racket-ball', label: '라켓·볼', emoji: '🏓' },
    { value: 'martial-arts', label: '무도·격투', emoji: '🥋' },
    { value: 'fitness-skill', label: '체력·기술', emoji: '🏋️' },
    { value: 'precision', label: '정밀·기술', emoji: '🎯' },
    { value: 'ice-snow', label: '빙상·설원', emoji: '⛷️' },
    { value: 'water', label: '수상·해양', emoji: '🏊' },
    { value: 'leisure', label: '레저·환경', emoji: '🚴' },
    { value: 'mind', label: '마인드', emoji: '🧠' },
    { value: 'other', label: '기타', emoji: '🎮' },
]

// 카테고리 한글 라벨 매핑
export const CATEGORY_LABELS: Record<Category, string> = {
    'team-ball': '구기·팀',
    'racket-ball': '라켓·볼',
    'martial-arts': '무도·격투',
    'fitness-skill': '체력·기술',
    precision: '정밀·기술',
    'ice-snow': '빙상·설원',
    water: '수상·해양',
    leisure: '레저·환경',
    mind: '마인드',
    other: '기타',
}

// 지역 정보
export const REGION_INFO: Record<string, { name: string; shortName: string; emoji: string }> = {
    seoul: { name: '서울특별시', shortName: '서울', emoji: '🏙️' },
    busan: { name: '부산광역시', shortName: '부산', emoji: '🌊' },
    daegu: { name: '대구광역시', shortName: '대구', emoji: '🏢' },
    incheon: { name: '인천광역시', shortName: '인천', emoji: '✈️' },
    gwangju: { name: '광주광역시', shortName: '광주', emoji: '🎨' },
    daejeon: { name: '대전광역시', shortName: '대전', emoji: '🔬' },
    ulsan: { name: '울산광역시', shortName: '울산', emoji: '🏭' },
    sejong: { name: '세종특별자치시', shortName: '세종', emoji: '🏛️' },
    gyeonggi: { name: '경기도', shortName: '경기', emoji: '🌆' },
    gangwon: { name: '강원도', shortName: '강원', emoji: '⛰️' },
    chungbuk: { name: '충청북도', shortName: '충북', emoji: '🏞️' },
    chungnam: { name: '충청남도', shortName: '충남', emoji: '🌾' },
    jeonbuk: { name: '전라북도', shortName: '전북', emoji: '🍚' },
    jeonnam: { name: '전라남도', shortName: '전남', emoji: '🌊' },
    gyeongbuk: { name: '경상북도', shortName: '경북', emoji: '🏔️' },
    gyeongnam: { name: '경상남도', shortName: '경남', emoji: '⚓' },
    jeju: { name: '제주특별자치도', shortName: '제주', emoji: '🏝️' },
}

// 지역별 중심 좌표
export const REGION_COORDINATES: Record<string, { lat: number; lng: number; level: number }> = {
    seoul: { lat: 37.5665, lng: 126.9780, level: 9 },
    busan: { lat: 35.1796, lng: 129.0756, level: 10 },
    daegu: { lat: 35.8714, lng: 128.6014, level: 10 },
    incheon: { lat: 37.4563, lng: 126.7052, level: 10 },
    gwangju: { lat: 35.1595, lng: 126.8526, level: 10 },
    daejeon: { lat: 36.3504, lng: 127.3845, level: 10 },
    ulsan: { lat: 35.5384, lng: 129.3114, level: 10 },
    sejong: { lat: 36.4800, lng: 127.2890, level: 10 },
    gyeonggi: { lat: 37.4138, lng: 127.5183, level: 11 },
    gangwon: { lat: 37.8228, lng: 128.1555, level: 12 },
    chungbuk: { lat: 36.6357, lng: 127.4914, level: 11 },
    chungnam: { lat: 36.5184, lng: 126.8000, level: 11 },
    jeonbuk: { lat: 35.7175, lng: 127.1530, level: 11 },
    jeonnam: { lat: 34.8161, lng: 126.4629, level: 11 },
    gyeongbuk: { lat: 36.4919, lng: 128.8889, level: 12 },
    gyeongnam: { lat: 35.4606, lng: 128.2132, level: 11 },
    jeju: { lat: 33.4890, lng: 126.4983, level: 10 },
}

// 지역 코드 매핑 (시/군/구 GeoJSON용)
export const REGION_CODE_MAP: Record<string, string> = {
    seoul: '11',
    busan: '21',
    daegu: '22',
    incheon: '23',
    gwangju: '24',
    daejeon: '25',
    ulsan: '26',
    sejong: '29',
    gyeonggi: '31',
    gangwon: '32',
    chungbuk: '33',
    chungnam: '34',
    jeonbuk: '35',
    jeonnam: '36',
    gyeongbuk: '37',
    gyeongnam: '38',
    jeju: '39',
}

// 광역시와 도의 관계 매핑
export const METRO_TO_PROVINCE: Record<string, string> = {
    gwangju: 'jeonnam',
    daejeon: 'chungnam',
    ulsan: 'gyeongnam',
}

// 역방향 매핑: 도 -> 광역시들
export const PROVINCE_TO_METROS: Record<string, string[]> = {
    jeonnam: ['gwangju'],
    chungnam: ['daejeon'],
    gyeongnam: ['ulsan'],
}

// 광역시 목록
export const METROPOLITAN_CITIES = ['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan']

// 카테고리 라벨 가져오기 (기본값 포함)
export function getCategoryLabel(category: Category): string {
    return CATEGORY_LABELS[category] || category
}
