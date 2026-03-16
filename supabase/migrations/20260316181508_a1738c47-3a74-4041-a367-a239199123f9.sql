CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    (SELECT municipality_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  );
$$;