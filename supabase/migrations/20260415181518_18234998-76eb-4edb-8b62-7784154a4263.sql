
CREATE TABLE public.report_access_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_token TEXT NOT NULL,
  access_code UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  professional_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.report_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage access codes"
ON public.report_access_codes
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_report_access_codes_lookup ON public.report_access_codes (access_code, report_token, used);
