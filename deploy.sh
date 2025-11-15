#!/bin/bash

# 스포터블 자동 배포 스크립트
# 사용법: ./deploy.sh <서버IP> [옵션]
# 예: ./deploy.sh 123.456.789.10
# 옵션: --full (전체 프로젝트 업로드, 기본은 dist만 업로드)

set -e  # 에러 발생 시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수: 진행 상황 출력
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 서버 IP 확인
if [ -z "$1" ]; then
    log_error "서버 IP를 입력해주세요"
    echo "사용법: ./deploy.sh <서버IP> [--full]"
    echo "예: ./deploy.sh 123.456.789.10"
    exit 1
fi

SERVER_IP=$1
SERVER_USER="ubuntu"
SERVER_PATH="/home/ubuntu/sport-contest"
FULL_DEPLOY=false

# 옵션 확인
if [ "$2" == "--full" ]; then
    FULL_DEPLOY=true
    log_info "전체 프로젝트 배포 모드"
fi

# 1. 로컬 빌드
log_info "프로젝트 빌드 중..."
npm run build

if [ ! -d "dist" ]; then
    log_error "빌드 실패: dist 폴더가 생성되지 않았습니다"
    exit 1
fi

log_info "빌드 완료!"

# 2. 서버 연결 테스트
log_info "서버 연결 테스트 중..."
if ! ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo '연결 성공'" > /dev/null 2>&1; then
    log_error "서버에 연결할 수 없습니다: $SERVER_USER@$SERVER_IP"
    log_warn "SSH 키 설정을 확인하거나 비밀번호 입력을 준비하세요"
    exit 1
fi

log_info "서버 연결 성공!"

# 3. 서버에 디렉터리 생성
log_info "서버 디렉터리 생성 중..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_PATH"

# 4. 파일 업로드
if [ "$FULL_DEPLOY" = true ]; then
    log_info "전체 프로젝트 업로드 중..."
    rsync -avz --progress --exclude 'node_modules' --exclude '.git' . $SERVER_USER@$SERVER_IP:$SERVER_PATH/
    
    # 서버에서 빌드
    log_info "서버에서 의존성 설치 및 빌드 중..."
    ssh $SERVER_USER@$SERVER_IP "cd $SERVER_PATH && npm install && npm run build"
else
    log_info "빌드 파일(dist) 업로드 중..."
    rsync -avz --progress dist/ $SERVER_USER@$SERVER_IP:$SERVER_PATH/dist/
fi

# 5. 권한 설정
log_info "파일 권한 설정 중..."
ssh $SERVER_USER@$SERVER_IP "chmod -R 755 $SERVER_PATH/dist"

# 6. Nginx 재시작 (선택사항)
log_info "Nginx 재시작 시도 중..."
if ssh $SERVER_USER@$SERVER_IP "sudo systemctl restart nginx" > /dev/null 2>&1; then
    log_info "Nginx 재시작 완료!"
else
    log_warn "Nginx 재시작 실패 (권한 문제일 수 있음). 서버에서 수동으로 재시작하세요:"
    echo "  sudo systemctl restart nginx"
fi

# 완료
echo ""
echo "================================================"
log_info "배포 완료!"
echo "================================================"
echo ""
echo "🌐 접속 주소: http://$SERVER_IP"
echo ""
echo "📝 배포 확인 사항:"
echo "  1. 브라우저에서 http://$SERVER_IP 접속"
echo "  2. 로그인/회원가입 기능 테스트"
echo "  3. 지도 검색 기능 테스트"
echo ""
echo "🔧 문제 발생 시:"
echo "  - 서버 로그: ssh $SERVER_USER@$SERVER_IP 'sudo tail -50 /var/log/nginx/error.log'"
echo "  - Nginx 상태: ssh $SERVER_USER@$SERVER_IP 'sudo systemctl status nginx'"
echo ""

