ALTER TABLE public.profiles ADD COLUMN health_survey_completed_at timestamptz DEFAULT NULL;

UPDATE public.profiles SET health_survey_completed_at = updated_at WHERE health_survey_completed = true;