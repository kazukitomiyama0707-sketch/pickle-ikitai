-- 一緒にプレーする相手を探す募集掲示板
CREATE TABLE IF NOT EXISTS matches (
  id            TEXT NOT NULL PRIMARY KEY,
  host_id       TEXT NOT NULL,
  facility_id   TEXT,
  facility_name TEXT NOT NULL,
  play_date     TEXT NOT NULL,
  time_band     TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'any',
  capacity      INTEGER NOT NULL DEFAULT 4,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_play_date ON matches(play_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_host ON matches(host_id);

CREATE TABLE IF NOT EXISTS match_participants (
  id         TEXT NOT NULL PRIMARY KEY,
  match_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  joined_at  TEXT NOT NULL,
  UNIQUE(match_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
