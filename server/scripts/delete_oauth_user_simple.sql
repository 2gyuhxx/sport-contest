-- 소셜 로그인 사용자 삭제 (간단 버전)
-- 이메일 주소만 변경하고 실행하면 됩니다

-- 삭제할 이메일 주소를 여기에 입력하세요
DELETE FROM session_tokens 
WHERE user_id IN (SELECT id FROM users WHERE email = 'lhgdream15@google.com');

DELETE FROM user_oauth_connections 
WHERE user_id IN (SELECT id FROM users WHERE email = 'lhgdream15@google.com');

DELETE FROM user_credentials 
WHERE user_id IN (SELECT id FROM users WHERE email = 'lhgdream15@google.com');

DELETE FROM users 
WHERE email = 'lhgdream15@google.com';

