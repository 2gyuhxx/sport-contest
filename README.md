# 어딘교

> 지역별 스포츠 대회·행사 정보를 한눈에 확인할 수 있는 인터랙티브 지도 기반 검색 플랫폼

## 📌 프로젝트 소개

어딘교는 대한민국 전역의 스포츠 대회 및 행사 정보를 지도 위에서 직관적으로 탐색할 수 있는 웹 서비스입니다.

### 주요 기능
- 🗺️ **인터랙티브 지도**: TopoJSON 기반 한국 지도에서 도/광역시 및 시·군·구 경계 확인
- 🔍 **다양한 필터링**: 지역, 종목, 키워드 기반 검색
- 🏆 **종목 카테고리**: 축구, 농구, 야구, 마라톤, 배구, e스포츠, 피트니스 등
- 📊 **큐레이션**: 인기 행사 TOP, AI 추천 행사
- 📱 **반응형 디자인**: 모바일/태블릿/데스크톱 지원

## 🚀 빠른 시작

### 1️⃣ 필수 요구사항

- **Node.js**: v18.0.0 이상 (권장: v20.x LTS)
- **npm**: v9.0.0 이상

> ⚠️ Node.js v22를 사용 중이라면 npm 권한 오류가 발생할 수 있습니다. v20 LTS 사용을 권장합니다.

### 2️⃣ 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repository-url>
cd sportContest

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

개발 서버가 정상적으로 실행되면 브라우저에서 `http://localhost:5173` 주소로 접속하세요.

### 3️⃣ 문제 해결

#### ❌ `npm install` 실패 시 (ERESOLVE 에러)

React 버전 충돌로 인한 오류입니다. 다음 명령어를 시도하세요:

```bash
# 방법 1: legacy peer deps 사용
npm install --legacy-peer-deps

# 방법 2: force 옵션 (비권장)
npm install --force
```

#### ❌ `npm run dev` 실패 시 (rollup 모듈 오류)

npm 캐시 문제일 수 있습니다. 다음 순서로 재설치하세요:

```bash
# 1. 기존 설치 파일 삭제
rm -rf node_modules package-lock.json

# 2. 의존성 재설치
npm install

# 3. 개발 서버 실행
npm run dev
```

#### ❌ Node.js v22에서 권한 오류 발생 시

Node.js 버전을 낮춰주세요:

```bash
# nvm 사용 시
nvm install 20
nvm use 20

# 그 후 다시 설치
npm install
npm run dev
```

## 📦 사용 가능한 스크립트

```bash
# 개발 서버 실행 (HMR 지원)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과물 미리보기
npm run preview

# ESLint 검사
npm run lint
```

## 🛠 기술 스택

### 핵심 기술
- **React 18** - UI 라이브러리
- **TypeScript** - 타입 안정성
- **Vite** - 빠른 번들러 및 개발 서버
- **React Router v7** - 라우팅

### UI/스타일
- **Tailwind CSS** - 유틸리티 기반 스타일링
- **Lucide React** - 아이콘 세트

### 지도 시각화
- **react-simple-maps** - 지도 렌더링
- **d3-geo** - 지리 데이터 처리
- **topojson-client** - TopoJSON 파싱

## 📂 프로젝트 구조

```
sportContest/
├── public/
│   └── maps/              # TopoJSON 지도 데이터
├── src/
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── CategoryFilter/
│   │   ├── EventCard/
│   │   ├── EventList/
│   │   ├── KoreaMap/
│   │   └── ...
│   ├── context/           # React Context (전역 상태)
│   ├── data/              # Mock 데이터 (events, regions)
│   ├── pages/             # 페이지 컴포넌트
│   │   ├── HomePage.tsx
│   │   ├── SearchPage.tsx
│   │   └── EventDetailPage.tsx
│   ├── router/            # 라우팅 설정
│   ├── services/          # 비즈니스 로직
│   ├── types/             # TypeScript 타입 정의
│   ├── ui/                # 레이아웃 컴포넌트
│   └── utils/             # 유틸리티 함수
├── package.json
└── vite.config.ts
```

## 🌐 주요 페이지

- `/` - 홈 (인기 행사, 추천 행사)
- `/search` - 지도 기반 검색
- `/events/:id` - 행사 상세 정보
- `/create` - 행사 등록 (개발 예정)

## 🔧 개발 가이드

### 새로운 행사 데이터 추가

`src/data/events.ts` 파일에서 Mock 데이터를 추가/수정할 수 있습니다:

```typescript
{
  id: 'event-xxx',
  title: '행사 제목',
  summary: '간단한 설명',
  region: 'seoul',        // 지역 ID (regions.ts 참고)
  city: '서울',
  address: '상세 주소',
  category: 'football',   // 종목 카테고리
  date: '2025-12-31',
  image: 'https://...',
  views: 0,
  pinOffset: { x: 0, y: 0 }  // 지도 핀 위치 조정
}
```

### 새로운 지역 추가

`src/data/regions.ts`에서 지역 메타데이터를 관리합니다.

## 🚀 배포하기

### NHN 클라우드 Ubuntu 서버 배포

**빠른 배포 (5분):**
```bash
# 자동 배포 스크립트 사용
./deploy.sh <서버IP>
```

**상세 가이드:**
- 📘 [상세 배포 가이드](./DEPLOYMENT.md) - NHN 클라우드 완전 설정 가이드
- ⚡ [빠른 배포 가이드](./QUICK_DEPLOY.md) - 5분 안에 배포하기

### 주요 배포 단계
1. 서버에 Node.js + Nginx 설치
2. 프로젝트 빌드 (`npm run build`)
3. dist 폴더를 서버에 업로드
4. Nginx 설정 및 재시작

자세한 내용은 배포 가이드 문서를 참고하세요!

## 📄 라이선스

MIT License

## 👥 기여자

프로젝트에 기여해주신 모든 분들께 감사드립니다.
