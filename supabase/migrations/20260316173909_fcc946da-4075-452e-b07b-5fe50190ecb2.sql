
-- Create collaborative_teams table
CREATE TABLE public.collaborative_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text DEFAULT '🏃',
  created_by uuid NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.collaborative_teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.collaborative_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS for collaborative_teams
CREATE POLICY "Admins can manage collaborative teams"
  ON public.collaborative_teams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view company teams"
  ON public.collaborative_teams FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can create teams in their company"
  ON public.collaborative_teams FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Team creators can update their teams"
  ON public.collaborative_teams FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND is_default = false);

CREATE POLICY "Team creators can delete their teams"
  ON public.collaborative_teams FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND is_default = false);

-- RLS for team_members
CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view team members of company teams"
  ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.collaborative_teams ct
    WHERE ct.id = team_members.team_id
    AND ct.company_id = get_user_company_id(auth.uid())
  ));

CREATE POLICY "Users can join teams"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.collaborative_teams ct
      WHERE ct.id = team_members.team_id
      AND ct.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can leave teams"
  ON public.team_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Company admin policies
CREATE POLICY "Company admins can manage company teams"
  ON public.collaborative_teams FOR ALL TO authenticated
  USING (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
  WITH CHECK (is_company_admin(auth.uid()) AND company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Company admins can manage company team members"
  ON public.team_members FOR ALL TO authenticated
  USING (
    is_company_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.collaborative_teams ct
      WHERE ct.id = team_members.team_id
      AND ct.company_id = get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    is_company_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.collaborative_teams ct
      WHERE ct.id = team_members.team_id
      AND ct.company_id = get_user_company_id(auth.uid())
    )
  );

-- Function to auto-create default "Geral" team when a company is created
CREATE OR REPLACE FUNCTION public.create_default_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.collaborative_teams (company_id, name, emoji, created_by, is_default)
  VALUES (NEW.id, 'Geral', '🌟', NEW.id, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created_create_default_team
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_team();
