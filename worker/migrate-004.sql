-- line_user_id / name の NOT NULL制約を外す（メール登録がLINE前提でINSERT失敗していた）
-- SQLiteはALTER COLUMNができないため、テーブル再作成で対応
CREATE TABLE users_new (
  id           TEXT PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  name         TEXT NOT NULL,
  avatar_url   TEXT,
  created_at   TEXT NOT NULL,
  bio          TEXT,
  avatar_key   TEXT,
  link_x       TEXT,
  link_instagram TEXT,
  link_tiktok  TEXT,
  link_web     TEXT,
  email        TEXT,
  password_hash TEXT
);
INSERT INTO users_new SELECT id, line_user_id, name, avatar_url, created_at, bio, avatar_key, link_x, link_instagram, link_tiktok, link_web, email, password_hash FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
