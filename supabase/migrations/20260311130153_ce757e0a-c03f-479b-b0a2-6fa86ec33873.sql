-- 1. Create helper function to break RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_municipality_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT municipality_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 2. Fix profiles policy
DROP POLICY IF EXISTS "Managers can view municipality profiles" ON public.profiles;
CREATE POLICY "Managers can view municipality profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND municipality_id = get_user_municipality_id(auth.uid())
);

-- 3. Fix notifications policies
DROP POLICY IF EXISTS "Managers can view municipality notifications" ON public.notifications;
CREATE POLICY "Managers can view municipality notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND municipality_id = get_user_municipality_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can view relevant notifications" ON public.notifications;
CREATE POLICY "Users can view relevant notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    (scope = 'municipal' AND target_user_id IS NULL AND municipality_id = get_user_municipality_id(auth.uid()))
    OR (scope = 'personal' AND target_user_id = auth.uid())
  )
);

-- 4. Fix esf_teams policy
DROP POLICY IF EXISTS "Managers can view municipality ESF teams" ON public.esf_teams;
CREATE POLICY "Managers can view municipality ESF teams" ON public.esf_teams
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND municipality_id = get_user_municipality_id(auth.uid())
);

-- 5. Fix appointments policy
DROP POLICY IF EXISTS "Managers can view municipality appointments" ON public.appointments;
CREATE POLICY "Managers can view municipality appointments" ON public.appointments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND municipality_id = get_user_municipality_id(auth.uid())
);