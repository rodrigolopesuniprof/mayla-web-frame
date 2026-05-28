ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points_tour_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS points_tour_current_step integer NOT NULL DEFAULT 0;