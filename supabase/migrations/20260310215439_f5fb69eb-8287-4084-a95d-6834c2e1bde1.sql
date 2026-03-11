
-- The enum app_role already has 'admin', 'manager', 'user'. 
-- We don't need to add 'moderator' since 'manager' already exists and fits the municipal secretary role.
-- Let's use 'manager' for municipal secretaries.

-- Add RLS policies for manager role to SELECT relevant tables filtered by municipality_id

-- Profiles: managers can view profiles from their municipality
CREATE POLICY "Managers can view municipality profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND municipality_id = (
    SELECT p.municipality_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- ESF teams: managers can view ESF teams from their municipality
CREATE POLICY "Managers can view municipality ESF teams"
ON public.esf_teams
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND municipality_id = (
    SELECT p.municipality_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- Notifications: managers can view notifications from their municipality
CREATE POLICY "Managers can view municipality notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND municipality_id = (
    SELECT p.municipality_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- Appointments: managers can view appointments from their municipality
CREATE POLICY "Managers can view municipality appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND municipality_id = (
    SELECT p.municipality_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);
