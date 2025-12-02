-- events 테이블에 views (조회수) 컬럼 추가

ALTER TABLE events 
ADD COLUMN views INT UNSIGNED NOT NULL DEFAULT 0 
AFTER website;

-- 인덱스 추가 (조회수 순 정렬 최적화)
CREATE INDEX idx_events_views ON events(views DESC);

-- 기존 데이터에 랜덤 조회수 설정 (선택사항 - 테스트용)
-- UPDATE events SET views = FLOOR(RAND() * 10000) WHERE status = 'approved';

