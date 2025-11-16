-- 소셜 로그인 사용자 삭제 스크립트
-- 사용법: 이메일 주소를 변경하고 실행하세요

-- 1. 삭제할 사용자의 ID 확인
SET @user_email = 'your-email@example.com';  -- 여기에 삭제할 이메일 주소 입력
SET @user_id = (SELECT id FROM users WHERE email = @user_email);

-- 2. 사용자가 존재하는지 확인
SELECT 
    @user_id AS user_id,
    (SELECT COUNT(*) FROM user_oauth_connections WHERE user_id = @user_id) AS oauth_connections,
    (SELECT COUNT(*) FROM user_credentials WHERE user_id = @user_id) AS credentials,
    (SELECT COUNT(*) FROM session_tokens WHERE user_id = @user_id) AS session_tokens;

-- 3. 관련 데이터 삭제 (순서 중요!)
-- 3-1. 세션 토큰 삭제
DELETE FROM session_tokens WHERE user_id = @user_id;

-- 3-2. OAuth 연결 삭제
DELETE FROM user_oauth_connections WHERE user_id = @user_id;

-- 3-3. 일반 로그인 비밀번호 삭제 (있는 경우)
DELETE FROM user_credentials WHERE user_id = @user_id;

-- 3-4. 사용자 삭제
DELETE FROM users WHERE id = @user_id;

-- 4. 삭제 확인
SELECT 
    '삭제 완료' AS status,
    @user_id AS deleted_user_id,
    @user_email AS deleted_email;

