ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mental_mood integer,
  ADD COLUMN IF NOT EXISTS mental_anxiety integer,
  ADD COLUMN IF NOT EXISTS mental_stress integer,
  ADD COLUMN IF NOT EXISTS mental_sleep integer,
  ADD COLUMN IF NOT EXISTS mental_social integer;