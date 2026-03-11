
-- 1. Wellbeing Check-ins
CREATE TABLE public.wellbeing_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  stress_level integer CHECK (stress_level BETWEEN 1 AND 5),
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  workload integer CHECK (workload BETWEEN 1 AND 5),
  mood integer CHECK (mood BETWEEN 1 AND 5),
  notes text,
  week_start date NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.wellbeing_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own checkins" ON public.wellbeing_checkins
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own checkins" ON public.wellbeing_checkins
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins" ON public.wellbeing_checkins
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all checkins" ON public.wellbeing_checkins
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Wellbeing Programs
CREATE TABLE public.wellbeing_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  emoji text DEFAULT '🌿',
  active boolean DEFAULT true,
  starts_at date,
  ends_at date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wellbeing_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wellbeing managers can manage programs" ON public.wellbeing_programs
FOR ALL TO authenticated
USING (public.is_wellbeing_manager(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (public.is_wellbeing_manager(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company admins can manage programs" ON public.wellbeing_programs
FOR ALL TO authenticated
USING (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Employees can view active programs" ON public.wellbeing_programs
FOR SELECT TO authenticated
USING (active = true AND company_id = public.get_user_company_id(auth.uid()));

-- 3. Program-Mission linking
CREATE TABLE public.program_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.wellbeing_programs(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, mission_id)
);

ALTER TABLE public.program_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wellbeing managers can manage program missions" ON public.program_missions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wellbeing_programs wp
  WHERE wp.id = program_id
  AND wp.company_id = public.get_user_company_id(auth.uid())
  AND (public.is_wellbeing_manager(auth.uid()) OR public.is_company_admin(auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.wellbeing_programs wp
  WHERE wp.id = program_id
  AND wp.company_id = public.get_user_company_id(auth.uid())
  AND (public.is_wellbeing_manager(auth.uid()) OR public.is_company_admin(auth.uid()))
));

CREATE POLICY "Employees can view program missions" ON public.program_missions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wellbeing_programs wp
  WHERE wp.id = program_id AND wp.active = true
  AND wp.company_id = public.get_user_company_id(auth.uid())
));

-- 4. Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL,
  description text,
  emoji text DEFAULT '🏆',
  category text DEFAULT 'challenge',
  bonus_points integer DEFAULT 0,
  badge_name text,
  badge_emoji text,
  active boolean DEFAULT true,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wellbeing managers can manage campaigns" ON public.campaigns
FOR ALL TO authenticated
USING (public.is_wellbeing_manager(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (public.is_wellbeing_manager(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company admins can manage campaigns" ON public.campaigns
FOR ALL TO authenticated
USING (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Employees can view active campaigns" ON public.campaigns
FOR SELECT TO authenticated
USING (active = true AND company_id = public.get_user_company_id(auth.uid()));

-- 5. Campaign Participants
CREATE TABLE public.campaign_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  points_earned integer DEFAULT 0,
  badge_awarded boolean DEFAULT false,
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can join campaigns" ON public.campaign_participants
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own participation" ON public.campaign_participants
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON public.campaign_participants
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all participants" ON public.campaign_participants
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Company admins can view company participants" ON public.campaign_participants
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = campaign_id AND c.company_id = public.get_user_company_id(auth.uid())
  AND (public.is_company_admin(auth.uid()) OR public.is_hr_manager(auth.uid()) OR public.is_wellbeing_manager(auth.uid()))
));
