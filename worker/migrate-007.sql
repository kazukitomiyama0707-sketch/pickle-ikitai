-- マーケ効果測定用の簡易ページビュー記録（Cookieなし・個人情報を持たない）
CREATE TABLE IF NOT EXISTS page_views (
  id         TEXT NOT NULL,
  path       TEXT NOT NULL,
  ref        TEXT,        -- document.referrer のホスト名のみ
  utm_source TEXT,        -- ?utm_source= の値（招待・LINE・X等の流入元タグ）
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source);
