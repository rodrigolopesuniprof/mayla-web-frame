CREATE OR REPLACE FUNCTION public.add_points_to_profile(_user_id uuid, _points integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + _points
  WHERE user_id = _user_id;
END;
$$;