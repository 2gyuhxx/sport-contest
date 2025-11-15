# 🚀 NHN 클라우드 Ubuntu 서버 배포 가이드

## 목차
1. [서버 환경 설정](#1-서버-환경-설정)
2. [프로젝트 배포 (방법 A: GitHub 사용)](#2a-프로젝트-배포-github-사용-권장)
3. [프로젝트 배포 (방법 B: 직접 업로드)](#2b-프로젝트-배포-직접-업로드)
4. [Nginx 웹 서버 설정](#3-nginx-웹-서버-설정)
5. [도메인 연결 및 HTTPS 설정](#4-도메인-연결-및-https-설정)
6. [문제 해결](#5-문제-해결)

---

## 1. 서버 환경 설정

### 1-1. 서버 접속
```bash
ssh ubuntu@<서버IP주소>
# 예: ssh ubuntu@123.456.789.10
```

### 1-2. 시스템 업데이트
```bash
sudo apt update && sudo apt upgrade -y
```

### 1-3. Node.js 설치 (v20 LTS)
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 설치 확인
node -v  # v20.x.x 출력되어야 함
npm -v   # 10.x.x 출력되어야 함
```

### 1-4. Git 설치 (GitHub 사용 시)
```bash
sudo apt install -y git
```

---

## 2A. 프로젝트 배포 (GitHub 사용 - 권장)

### 2A-1. GitHub에 코드 푸시 (로컬에서)
```bash
# 현재 프로젝트 디렉터리에서
git add .
git commit -m "배포 준비"
git push origin master  # 또는 main
```

### 2A-2. 서버에서 클론
```bash
# 서버에 접속한 상태에서
cd /home/ubuntu
git clone https://github.com/<사용자명>/sport-contest.git
cd sport-contest

# 의존성 설치
npm install

# 프로덕션 빌드
npm run build
```

---

## 2B. 프로젝트 배포 (직접 업로드)

### 2B-1. 로컬에서 빌드
```bash
# 로컬 프로젝트 디렉터리에서
npm run build
```

### 2B-2. 서버로 업로드
```bash
# 로컬 터미널에서 (dist 폴더만 업로드)
scp -r dist ubuntu@<서버IP>:/home/ubuntu/sportcontest/

# 또는 전체 프로젝트 업로드
scp -r . ubuntu@<서버IP>:/home/ubuntu/sportcontest/
```

---

## 3. Nginx 웹 서버 설정

### 3-1. Nginx 설치
```bash
sudo apt install -y nginx
```

### 3-2. Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/sportcontest
```

다음 내용을 입력:

```nginx
server {
    listen 80;
    server_name <서버IP또는도메인>;  # 예: 123.456.789.10 또는 sportcontest.com

    root /home/ubuntu/sport-contest/dist;
    index index.html;

    # Gzip 압축 활성화
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 3-3. 설정 활성화
```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/sportcontest /etc/nginx/sites-enabled/

# 기본 설정 제거 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx  # 부팅 시 자동 시작
```

### 3-4. 방화벽 설정
```bash
# UFW 방화벽 설정
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (나중에 사용)
sudo ufw enable
sudo ufw status
```

---

## 4. 도메인 연결 및 HTTPS 설정

### 4-1. 도메인이 있는 경우

**DNS 설정 (도메인 관리 페이지에서):**
```
A 레코드: @ -> 서버IP주소
A 레코드: www -> 서버IP주소
```

### 4-2. Let's Encrypt SSL 인증서 설치
```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 및 자동 설정
sudo certbot --nginx -d <도메인> -d www.<도메인>
# 예: sudo certbot --nginx -d sportcontest.com -d www.sportcontest.com

# 이메일 입력 요청 시 입력
# 약관 동의: Y
# 이메일 수신 동의: N (선택)
# HTTP -> HTTPS 리다이렉트: 2 선택 (권장)

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

---

## 5. 문제 해결

### 5-1. 502 Bad Gateway 오류
```bash
# Nginx 로그 확인
sudo tail -f /var/log/nginx/error.log

# 권한 문제 해결
sudo chmod -R 755 /home/ubuntu/sport-contest/dist
```

### 5-2. 파일 업데이트 반영이 안 될 때
```bash
# 브라우저 캐시 삭제 또는 강력 새로고침 (Ctrl+Shift+R)

# Nginx 캐시 삭제
sudo systemctl restart nginx
```

### 5-3. React Router 404 오류
Nginx 설정에 `try_files $uri $uri/ /index.html;` 가 있는지 확인

### 5-4. 빌드 파일 업데이트
```bash
# GitHub 사용 시
cd /home/ubuntu/sport-contest
git pull origin master
npm install
npm run build
sudo systemctl restart nginx

# 직접 업로드 시
# 로컬에서 다시 빌드 후 업로드
```

---

## 6. 추가 최적화 (선택사항)

### 6-1. PM2로 정적 파일 서버 운영 (대안)
```bash
# PM2 설치
sudo npm install -g pm2

# serve 설치
sudo npm install -g serve

# 앱 실행
cd /home/ubuntu/sport-contest/dist
pm2 serve . 3000 --name sportcontest --spa

# 부팅 시 자동 시작
pm2 startup
pm2 save
```

### 6-2. 로그 모니터링
```bash
# Nginx 접근 로그
sudo tail -f /var/log/nginx/access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log
```

---

## 📝 체크리스트

배포 전 확인사항:
- [ ] 서버 SSH 접속 가능
- [ ] Node.js 설치 완료
- [ ] 프로젝트 빌드 성공 (`npm run build`)
- [ ] Nginx 설치 및 설정 완료
- [ ] 방화벽 포트 80, 443 오픈
- [ ] 도메인 DNS 설정 (도메인 사용 시)
- [ ] SSL 인증서 설치 (HTTPS 사용 시)

배포 후 테스트:
- [ ] `http://<서버IP>` 접속 테스트
- [ ] 로그인/회원가입 기능 테스트
- [ ] 지도 검색 기능 테스트
- [ ] 브라우저 개발자 도구에서 에러 확인

---

## 🆘 도움이 필요하면

1. **Nginx 상태 확인**: `sudo systemctl status nginx`
2. **에러 로그 확인**: `sudo tail -50 /var/log/nginx/error.log`
3. **포트 사용 확인**: `sudo netstat -tulpn | grep :80`
4. **디렉터리 권한 확인**: `ls -la /home/ubuntu/sport-contest/dist`

---

## 📚 참고 링크

- [NHN 클라우드 공식 문서](https://docs.nhncloud.com/)
- [Nginx 공식 문서](https://nginx.org/en/docs/)
- [Let's Encrypt 공식 사이트](https://letsencrypt.org/)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)

