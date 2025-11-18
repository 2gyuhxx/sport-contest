# 스팸 모델 자동 다운로드 설정 가이드

## 📋 설정 단계

### 1. `.env` 파일에 NHN Cloud Object Storage 설정 추가

`server/.env` 파일에 다음 환경 변수를 추가하세요:

```env
# NHN Cloud Object Storage 설정 (스팸 모델 다운로드용)
NHN_CLOUD_ENDPOINT=https://kr1-api-objectstorage.nhncloudservice.com
NHN_CLOUD_BUCKET_NAME=여기에_버킷_이름_입력
NHN_CLOUD_MODEL_KEY=spam_model_ver1.pth

# 필수: NHN Cloud Object Storage 인증 정보
NHN_CLOUD_ACCESS_KEY=여기에_액세스_키_입력
NHN_CLOUD_SECRET_KEY=여기에_시크릿_키_입력
```

### 2. NHN Cloud Object Storage 정보 확인 방법

1. NHN Cloud 콘솔에 로그인
2. Object Storage 메뉴로 이동
3. 다음 정보를 확인:
   - **Access Key**: Object Storage > API 인증키에서 확인
   - **Secret Key**: Object Storage > API 인증키에서 확인
   - **Endpoint**: 리전별 엔드포인트 (예: `https://kr1-api-objectstorage.nhncloudservice.com`)
   - **Bucket Name**: 모델 파일이 저장된 버킷 이름
   - **Object Key**: 모델 파일의 경로 (예: `spam_model_ver1.pth`)

### 3. 서버 실행

서버를 실행하면 자동으로 모델 파일을 다운로드합니다:

```bash
cd server
npm run dev
```

서버 시작 시 다음과 같은 로그가 표시됩니다:
- 모델 파일이 이미 존재하는 경우: `[모델 다운로드] 모델 파일이 이미 존재합니다. 다운로드를 스킵합니다.`
- 모델 파일을 다운로드하는 경우: `[모델 다운로드] 모델 파일을 {경로}에 저장했습니다.`
- 다운로드 실패 시: 경고 메시지가 표시됩니다

### 4. 문제 해결

#### 모델 파일이 다운로드되지 않는 경우

1. `.env` 파일의 환경 변수가 올바른지 확인
2. NHN Cloud Object Storage 접근 권한 확인
3. 버킷 이름과 객체 키가 올바른지 확인
4. 네트워크 연결 확인

#### 서버는 시작되지만 스팸 체크가 작동하지 않는 경우

- 모델 파일이 `server/models/spam_model_ver1.pth`에 있는지 확인
- 서버 로그에서 모델 다운로드 오류 메시지 확인

### 5. 모델 파일 위치

다운로드된 모델 파일은 다음 위치에 저장됩니다:
- `server/models/spam_model_ver1.pth`

이 파일은 `.gitignore`에 포함되어 Git에 커밋되지 않습니다.

