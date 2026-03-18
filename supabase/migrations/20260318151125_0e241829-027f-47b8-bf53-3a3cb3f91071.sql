
-- Table for company invite tokens
CREATE TABLE public.company_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage invite tokens"
  ON public.company_invite_tokens FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Company admins can view their own tokens
CREATE POLICY "Company admins can view own tokens"
  ON public.company_invite_tokens FOR SELECT
  TO authenticated
  USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

-- Anyone (anon) can read tokens to validate during signup
CREATE POLICY "Anyone can validate tokens"
  ON public.company_invite_tokens FOR SELECT
  TO anon
  USING (true);

-- Auto-generate token when a company is created
CREATE OR REPLACE FUNCTION public.create_company_invite_token()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_invite_tokens (company_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created_invite_token
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_company_invite_token();
