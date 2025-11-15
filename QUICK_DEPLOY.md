# ⚡ 빠른 배포 가이드 (5분 완성)

## 🎯 최소 단계 배포

### 1️⃣ 서버에서 환경 설정 (최초 1회만)

```bash
# SSH 접속
ssh ubuntu@<서버IP>

# Node.js + Nginx 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs nginx git

# 방화벽 설정
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2️⃣ Nginx 설정

```bash
# 설정 파일 생성
sudo nano /etc/nginx/sites-available/sportcontest
```

**다음 내용 붙여넣기:**
```nginx
server {
    listen 80;
    server_name _;
    root /home/ubuntu/sport-contest/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**활성화:**
```bash
sudo ln -s /etc/nginx/sites-available/sportcontest /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 3️⃣ 로컬에서 배포 (매번 실행)

```bash
# 자동 배포 스크립트 사용
./deploy.sh <서버IP>

# 또는 수동 배포
npm run build
scp -r dist ubuntu@<서버IP>:/home/ubuntu/sport-contest/
```

### 4️⃣ 완료!

브라우저에서 `http://<서버IP>` 접속

---

## 🔄 업데이트 배포

코드 수정 후:
```bash
./deploy.sh <서버IP>
```

끝! 🎉

---

## 🆘 문제 해결

**접속이 안 돼요:**
```bash
# 서버에서 로그 확인
ssh ubuntu@<서버IP> "sudo tail -20 /var/log/nginx/error.log"
```

**페이지가 안 뜨요:**
```bash
# 권한 설정
ssh ubuntu@<서버IP> "chmod -R 755 /home/ubuntu/sport-contest/dist"
```

**404 오류:**
- Nginx 설정에 `try_files $uri $uri/ /index.html;` 확인

---

## 📱 NHN 클라우드 체크리스트

- [ ] 인스턴스 생성 완료
- [ ] Floating IP 할당
- [ ] 보안 그룹: TCP 22, 80, 443 포트 오픈
- [ ] SSH 키페어 다운로드
- [ ] SSH 접속 테스트 완료

자세한 내용은 `DEPLOYMENT.md` 참고!

