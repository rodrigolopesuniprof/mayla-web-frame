
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS peso numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS altura numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_bedridden_at_home boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_pregnant_at_home boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_child_under_5 boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_child_under_12 boolean DEFAULT false;
