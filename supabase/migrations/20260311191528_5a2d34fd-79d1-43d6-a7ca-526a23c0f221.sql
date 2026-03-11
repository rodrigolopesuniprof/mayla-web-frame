
-- Fix: recreate view with security_invoker to prevent security definer issue
DROP VIEW IF EXISTS public.company_health_summary;
CREATE VIEW public.company_health_summary
WITH (security_invoker = on) AS
SELECT 
  p.company_id,
  count(DISTINCT hm.user_id) as active_users,
  round(avg(hm.heart_rate)::numeric, 1) as avg_heart_rate,
  round(avg(hm.stress_level)::numeric, 1) as avg_stress_level,
  round(avg(hm.spo2)::numeric, 1) as avg_spo2,
  date_trunc('week', hm.measured_at) as week
FROM health_measurements hm
JOIN profiles p ON p.user_id = hm.user_id
WHERE p.company_id IS NOT NULL
GROUP BY p.company_id, date_trunc('week', hm.measured_at);
