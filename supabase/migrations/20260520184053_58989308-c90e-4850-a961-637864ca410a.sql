-- 1) Missões: campos para mensagem e link de ação pós-sucesso
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS success_message text,
  ADD COLUMN IF NOT EXISTS success_link_url text,
  ADD COLUMN IF NOT EXISTS success_link_label text;

-- 2) Persistir o link do Google Maps usado para cadastrar o local
ALTER TABLE public.partner_locations
  ADD COLUMN IF NOT EXISTS google_maps_url text;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS google_maps_url text;

-- 3) Novo tipo "outro" para parceiros gerais
ALTER TYPE public.partner_type ADD VALUE IF NOT EXISTS 'other';