
-- Add IBGE code to municipalities for CNES API integration
ALTER TABLE public.municipalities ADD COLUMN codigo_ibge INTEGER;
