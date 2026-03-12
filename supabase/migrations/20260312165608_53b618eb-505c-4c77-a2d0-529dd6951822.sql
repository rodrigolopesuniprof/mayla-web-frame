
-- Add program_id to campaigns
ALTER TABLE public.campaigns ADD COLUMN program_id uuid REFERENCES public.wellbeing_programs(id) ON DELETE SET NULL;

-- Create campaign_missions junction table
CREATE TABLE public.campaign_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, mission_id)
);

ALTER TABLE public.campaign_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaign missions" ON public.campaign_missions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view campaign missions" ON public.campaign_missions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.active = true AND c.company_id = get_user_company_id(auth.uid())));

CREATE POLICY "Managers can manage campaign missions" ON public.campaign_missions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.company_id = get_user_company_id(auth.uid()) AND (is_wellbeing_manager(auth.uid()) OR is_company_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_missions.campaign_id AND c.company_id = get_user_company_id(auth.uid()) AND (is_wellbeing_manager(auth.uid()) OR is_company_admin(auth.uid()))));
