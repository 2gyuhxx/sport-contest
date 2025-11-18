-- events 테이블에 sub_sport 컬럼 추가 (스포츠 소분류 저장용)

ALTER TABLE events 
ADD COLUMN sub_sport VARCHAR(100) NULL 
AFTER sport;

-- 기존 데이터는 NULL로 유지

