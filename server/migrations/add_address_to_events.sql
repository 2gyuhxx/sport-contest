-- events 테이블에 address 컬럼 추가 (우편번호 저장용)
-- 5자리 고정 문자열로 저장 (예: "00123", "12345")

ALTER TABLE events 
ADD COLUMN address VARCHAR(5) NULL 
AFTER venue;

-- 기존 데이터는 NULL로 유지
-- 우편번호는 5자리 고정 문자열이므로 VARCHAR(5) 사용
