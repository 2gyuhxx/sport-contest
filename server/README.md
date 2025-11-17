# 백엔드 서버

스포츠 대회 플랫폼 백엔드 API 서버입니다.

## 설치 및 실행

### 1. 의존성 설치

```bash
cd server
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# 서버 설정
PORT=3001

# MySQL 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sport_contest

# JWT 설정
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS 설정
CORS_ORIGIN=http://localhost:5173

# NHN Cloud Object Storage 설정 (스팸 모델 다운로드용)
NHN_CLOUD_ACCESS_KEY=your_access_key
NHN_CLOUD_SECRET_KEY=your_secret_key
NHN_CLOUD_ENDPOINT=https://kr1-api-objectstorage.nhncloudservice.com
NHN_CLOUD_BUCKET_NAME=your_bucket_name
NHN_CLOUD_MODEL_KEY=spam_model_ver1.pth
```

### 3. 데이터베이스 설정

MySQL 데이터베이스를 생성하고 `Sport_contest_DB.sql` 파일을 실행하여 테이블을 생성하세요.

### 4. 개발 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

## API 엔드포인트

### 인증 (Auth)

- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 로그인 요청 예시

```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 로그인 응답 예시

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "phone": null,
    "sports": null,
    "manager": false,
    "is_verified": false,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "abc123def456..."
}
```

