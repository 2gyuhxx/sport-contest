-- events 테이블에 reports_count, reports_state 컬럼 추가
-- events_reports 테이블 생성

-- 1. events 테이블에 신고 관련 컬럼 추가
ALTER TABLE events 
ADD COLUMN reports_count INT UNSIGNED NOT NULL DEFAULT 0 
AFTER views;

ALTER TABLE events 
ADD COLUMN reports_state ENUM('normal', 'pending', 'blocked') NOT NULL DEFAULT 'normal' 
AFTER reports_count;

-- 2. events_reports 테이블 생성
CREATE TABLE IF NOT EXISTS events_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  events_id INT UNSIGNED NOT NULL,
  report_reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (events_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_event_report (user_id, events_id),
  INDEX idx_events_id (events_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

