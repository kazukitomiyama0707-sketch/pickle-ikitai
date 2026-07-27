-- 招待経由の登録を記録（口コミ拡散の計測）
ALTER TABLE users ADD COLUMN referred_by TEXT;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
