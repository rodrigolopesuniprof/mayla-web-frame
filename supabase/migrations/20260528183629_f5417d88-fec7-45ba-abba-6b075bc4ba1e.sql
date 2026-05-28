
CREATE TABLE public.clinical_profile_field_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  section text NOT NULL CHECK (section IN ('saude','endereco','familia')),
  sort_order integer NOT NULL DEFAULT 100,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clinical_profile_field_config_unique
  ON public.clinical_profile_field_config (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), field_key);

GRANT SELECT ON public.clinical_profile_field_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_profile_field_config TO authenticated;
GRANT ALL ON public.clinical_profile_field_config TO service_role;

ALTER TABLE public.clinical_profile_field_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read field config"
ON public.clinical_profile_field_config FOR SELECT
USING (true);

CREATE POLICY "admins can insert field config"
ON public.clinical_profile_field_config FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "admins can update field config"
ON public.clinical_profile_field_config FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "admins can delete field config"
ON public.clinical_profile_field_config FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (company_id IS NOT NULL AND public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
);

CREATE TRIGGER clinical_profile_field_config_updated_at
BEFORE UPDATE ON public.clinical_profile_field_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_effective_clinical_fields(_company_id uuid)
RETURNS TABLE(field_key text, label text, section text, sort_order integer, visible boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _has_custom boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.clinical_profile_field_config WHERE company_id = _company_id) INTO _has_custom;
  IF _has_custom THEN
    RETURN QUERY
      SELECT c.field_key, c.label, c.section, c.sort_order, c.visible
      FROM public.clinical_profile_field_config c
      WHERE c.company_id = _company_id
      ORDER BY c.section, c.sort_order;
  ELSE
    RETURN QUERY
      SELECT c.field_key, c.label, c.section, c.sort_order, c.visible
      FROM public.clinical_profile_field_config c
      WHERE c.company_id IS NULL
      ORDER BY c.section, c.sort_order;
  END IF;
END;
$$;

-- Seed default global config
INSERT INTO public.clinical_profile_field_config (company_id, field_key, label, section, sort_order, visible) VALUES
  (NULL, 'biological_sex',      'Sexo biológico',              'saude',    10, true),
  (NULL, 'is_pregnant',         'Gravidez',                    'saude',    20, true),
  (NULL, 'has_hypertension',    'Hipertensão',                 'saude',    30, true),
  (NULL, 'has_diabetes',        'Diabetes',                    'saude',    40, true),
  (NULL, 'peso',                'Peso',                        'saude',    50, true),
  (NULL, 'altura',              'Altura',                      'saude',    60, true),
  (NULL, 'last_dental_visit',   'Última ida ao dentista',      'saude',    70, true),
  (NULL, 'cep',                 'CEP',                         'endereco', 10, true),
  (NULL, 'endereco',            'Endereço',                    'endereco', 20, true),
  (NULL, 'cidade',              'Cidade',                      'endereco', 30, true),
  (NULL, 'lives_with_infant',   'Mora com criança < 1 ano',    'familia',  10, true),
  (NULL, 'has_child_under_5',   'Criança < 5 anos em casa',    'familia',  20, true),
  (NULL, 'has_child_under_12',  'Filho < 12 anos (vacinas)',   'familia',  30, true),
  (NULL, 'has_bedridden_at_home','Acamado em casa',            'familia',  40, true),
  (NULL, 'has_pregnant_at_home','Grávida em casa',             'familia',  50, true),
  (NULL, 'is_bolsa_familia',    'Bolsa Família',               'familia',  60, true),
  (NULL, 'last_acs_visit',      'Visita ACS recente',          'familia',  70, true);
