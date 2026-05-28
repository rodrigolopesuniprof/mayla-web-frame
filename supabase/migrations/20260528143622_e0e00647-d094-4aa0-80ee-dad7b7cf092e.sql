ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_type TEXT NOT NULL DEFAULT 'initials'
    CHECK (avatar_type IN ('initials', 'dicebear', 'readyplayerme')),
  ADD COLUMN IF NOT EXISTS avatar_points_awarded BOOLEAN NOT NULL DEFAULT false;