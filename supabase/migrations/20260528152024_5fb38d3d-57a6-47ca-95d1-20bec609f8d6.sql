ALTER VIEW public.company_leaderboard SET (security_invoker = false);
GRANT SELECT ON public.company_leaderboard TO authenticated;