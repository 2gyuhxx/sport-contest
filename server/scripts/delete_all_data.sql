-- ⚠️ 경고: 이 스크립트는 모든 테이블의 데이터를 삭제합니다!
-- 실행 전에 반드시 백업을 해주세요!

-- 외래키 체크 비활성화 (삭제 순서 문제 해결)
SET FOREIGN_KEY_CHECKS = 0;

-- 1. 세션 토큰 삭제
DELETE FROM session_tokens;

-- 2. OAuth 연결 삭제
DELETE FROM user_oauth_connections;

-- 3. 사용자 자격 증명 삭제
DELETE FROM user_credentials;

-- 4. 이벤트 삭제
DELETE FROM events;

-- 5. 사용자 삭제
DELETE FROM users;

-- 6. OAuth 제공자 삭제 (선택사항 - 필요하면 주석 해제)
-- DELETE FROM oauth_providers;

-- 외래키 체크 재활성화
SET FOREIGN_KEY_CHECKS = 1;

-- 삭제 확인
SELECT 
    (SELECT COUNT(*) FROM session_tokens) AS session_tokens_count,
    (SELECT COUNT(*) FROM user_oauth_connections) AS oauth_connections_count,
    (SELECT COUNT(*) FROM user_credentials) AS credentials_count,
    (SELECT COUNT(*) FROM events) AS events_count,
    (SELECT COUNT(*) FROM users) AS users_count,
    (SELECT COUNT(*) FROM oauth_providers) AS oauth_providers_count;

