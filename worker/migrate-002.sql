-- ユーザープロフィール拡張（プロフ画像・自己紹介・SNSリンク）
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN link_x TEXT;
ALTER TABLE users ADD COLUMN link_instagram TEXT;
ALTER TABLE users ADD COLUMN link_tiktok TEXT;
ALTER TABLE users ADD COLUMN link_web TEXT;
