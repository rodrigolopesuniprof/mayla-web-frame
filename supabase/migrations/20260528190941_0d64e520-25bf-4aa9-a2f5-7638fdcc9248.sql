ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS how_to_participate text,
ADD COLUMN IF NOT EXISTS completion_criteria text;