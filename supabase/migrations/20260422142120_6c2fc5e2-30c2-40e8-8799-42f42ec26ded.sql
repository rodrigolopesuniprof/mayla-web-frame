-- Adiciona colunas de escopo
ALTER TABLE public.health_articles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_health_articles_company_id ON public.health_articles(company_id);
CREATE INDEX IF NOT EXISTS idx_health_articles_is_global ON public.health_articles(is_global);

-- Remove policies antigas para recriar com escopo
DROP POLICY IF EXISTS "Admins manage articles" ON public.health_articles;
DROP POLICY IF EXISTS "Authenticated users read active articles" ON public.health_articles;

-- LEITURA: usuário vê artigos ativos da sua empresa OU globais
CREATE POLICY "Users read scoped active articles"
  ON public.health_articles
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      (is_global = true AND company_id IS NULL)
      OR (company_id = get_user_company_id(auth.uid()))
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- SUPER ADMIN: gerencia tudo
CREATE POLICY "Admins manage all articles"
  ON public.health_articles
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- COMPANY ADMIN: gerencia apenas artigos da própria empresa, e não pode marcar como global
CREATE POLICY "Company admins insert own company articles"
  ON public.health_articles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND is_global = false
  );

CREATE POLICY "Company admins update own company articles"
  ON public.health_articles
  FOR UPDATE
  TO authenticated
  USING (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND is_global = false
  )
  WITH CHECK (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND is_global = false
  );

CREATE POLICY "Company admins delete own company articles"
  ON public.health_articles
  FOR DELETE
  TO authenticated
  USING (
    is_company_admin(auth.uid())
    AND company_id = get_user_company_id(auth.uid())
    AND is_global = false
  );