-- users 테이블에 sport1, sport2, sport3 컬럼 추가
ALTER TABLE users 
ADD COLUMN sport1 VARCHAR(50) NULL AFTER sports,
ADD COLUMN sport2 VARCHAR(50) NULL AFTER sport1,
ADD COLUMN sport3 VARCHAR(50) NULL AFTER sport2;

-- 기존 sports 컬럼의 데이터를 sport1로 이동 (선택사항)
-- UPDATE users SET sport1 = sports WHERE sports IS NOT NULL;

-- sports 컬럼 제거 (선택사항 - 기존 데이터 보존이 필요하면 주석 처리)
-- ALTER TABLE users DROP COLUMN sports;

