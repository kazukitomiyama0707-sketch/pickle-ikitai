-- ログイン試行のレート制限（ブルートフォース対策）
CREATE TABLE IF NOT EXISTS login_attempts (
  email      TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempted_at);
