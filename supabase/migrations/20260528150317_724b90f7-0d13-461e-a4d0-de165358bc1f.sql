ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_style TEXT NOT NULL DEFAULT 'adventurer'
    CHECK (avatar_style IN (
      'adventurer','avataaars','bottts','lorelei',
      'micah','notionists','openPeeps','personas','thumbs'
    )),
  ADD COLUMN IF NOT EXISTS avatar_seed TEXT,
  ADD COLUMN IF NOT EXISTS avatar_points_awarded BOOLEAN NOT NULL DEFAULT false;