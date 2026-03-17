
-- Add 'finished' and 'missed' to the consultation_status enum
ALTER TYPE public.consultation_status ADD VALUE IF NOT EXISTS 'finished';
ALTER TYPE public.consultation_status ADD VALUE IF NOT EXISTS 'missed';
