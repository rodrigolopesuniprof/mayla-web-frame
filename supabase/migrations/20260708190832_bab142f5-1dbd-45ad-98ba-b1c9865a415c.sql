
CREATE TABLE public.demo_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT DEFAULT 'binah_demo',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.demo_leads TO anon, authenticated;
GRANT ALL ON public.demo_leads TO service_role;
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit demo lead" ON public.demo_leads FOR INSERT TO anon, authenticated WITH CHECK (
  length(trim(name)) BETWEEN 2 AND 120
  AND length(regexp_replace(phone, '\D', '', 'g')) BETWEEN 8 AND 20
);
CREATE POLICY "Admins can read leads" ON public.demo_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
