-- events 테이블에 status 컬럼 추가
-- pending: 판정 중 (기본값)
-- approved: 정상 등록
-- spam: 스팸 처리

ALTER TABLE events 
ADD COLUMN status ENUM('pending', 'approved', 'spam') NOT NULL DEFAULT 'pending' 
AFTER website;

-- 기존 행사들은 모두 approved로 설정 (이미 등록된 행사는 정상으로 간주)
UPDATE events SET status = 'approved' WHERE status = 'pending';

