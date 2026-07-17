-- ピックルイキタイ D1 スキーマ

-- ユーザー（LINEログイン）
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,           -- 内部ID (uuid)
  line_user_id TEXT UNIQUE NOT NULL,       -- LINEのsub
  name         TEXT NOT NULL,              -- 表示名（初期値はLINE displayName、変更可）
  avatar_url   TEXT,
  created_at   TEXT NOT NULL
);

-- ピク活（プレー記録）
CREATE TABLE IF NOT EXISTS pikkatsu (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  facility_id     TEXT NOT NULL,
  played_at       TEXT NOT NULL,           -- YYYY-MM-DD
  time_band       TEXT NOT NULL,           -- "19-21"
  party_size      INTEGER NOT NULL,
  crowd           INTEGER NOT NULL,        -- 1=空いてた 2=ちょうどいい 3=混んでた
  court_condition TEXT,
  comment         TEXT,
  photo_key       TEXT,                    -- R2のオブジェクトキー
  likes           INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pik_facility ON pikkatsu(facility_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_pik_created  ON pikkatsu(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pik_user     ON pikkatsu(user_id);

-- いいね（1ユーザー1回まで）
CREATE TABLE IF NOT EXISTS likes (
  pikkatsu_id TEXT NOT NULL REFERENCES pikkatsu(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (pikkatsu_id, user_id)
);

-- ユーザー投稿のコート
CREATE TABLE IF NOT EXISTS user_courts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  area       TEXT NOT NULL,
  cat        TEXT NOT NULL,
  indoor     INTEGER NOT NULL,
  price      TEXT,
  note       TEXT,
  url        TEXT,
  photo_key  TEXT,                         -- 公式サイトから取得した画像 or 投稿画像
  status     TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected
  created_at TEXT NOT NULL
);
