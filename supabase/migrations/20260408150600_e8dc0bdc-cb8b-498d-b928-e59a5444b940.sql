-- Add source_type column
ALTER TABLE public.prontuario_connections
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'meddit';

-- Add internal_partner_id for mayla partners
ALTER TABLE public.prontuario_connections
ADD COLUMN IF NOT EXISTS internal_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL;