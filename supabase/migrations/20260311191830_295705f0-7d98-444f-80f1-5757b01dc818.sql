
-- Aggregated wellbeing check-in summary (anonymized, by company & week)
CREATE VIEW public.company_wellbeing_summary
WITH (security_invoker = on) AS
SELECT 
  wc.company_id,
  wc.week_start,
  count(*) as total_checkins,
  count(DISTINCT wc.user_id) as unique_participants,
  round(avg(wc.stress_level)::numeric, 2) as avg_stress,
  round(avg(wc.sleep_quality)::numeric, 2) as avg_sleep,
  round(avg(wc.workload)::numeric, 2) as avg_workload,
  round(avg(wc.mood)::numeric, 2) as avg_mood,
  round(((avg(wc.mood) + avg(wc.sleep_quality) + (6 - avg(wc.stress_level)) + (6 - avg(wc.workload))) / 4.0)::numeric, 2) as wellbeing_index
FROM wellbeing_checkins wc
WHERE wc.company_id IS NOT NULL
GROUP BY wc.company_id, wc.week_start;

-- Aggregated campaign engagement summary
CREATE VIEW public.company_campaign_summary
WITH (security_invoker = on) AS
SELECT 
  c.company_id,
  c.id as campaign_id,
  c.title,
  c.starts_at,
  c.ends_at,
  count(cp.id) as total_participants,
  count(cp.completed_at) as total_completed,
  sum(cp.points_earned) as total_points_awarded,
  count(CASE WHEN cp.badge_awarded THEN 1 END) as badges_awarded
FROM campaigns c
LEFT JOIN campaign_participants cp ON cp.campaign_id = c.id
GROUP BY c.company_id, c.id, c.title, c.starts_at, c.ends_at;

-- Aggregated program engagement
CREATE VIEW public.company_program_summary
WITH (security_invoker = on) AS
SELECT
  wp.company_id,
  wp.id as program_id,
  wp.title,
  wp.category,
  wp.active,
  count(DISTINCT pm.mission_id) as total_missions,
  count(DISTINCT um.user_id) as participants,
  count(CASE WHEN um.status = 'completed' THEN 1 END) as completed_missions
FROM wellbeing_programs wp
LEFT JOIN program_missions pm ON pm.program_id = wp.id
LEFT JOIN user_missions um ON um.mission_id = pm.mission_id
GROUP BY wp.company_id, wp.id, wp.title, wp.category, wp.active;

-- Grant HR managers SELECT on aggregated checkin data via RLS on the source table
-- (the view uses security_invoker, so HR needs access to the underlying table for aggregated queries)
-- Instead, we'll create a function for safe aggregated access
CREATE OR REPLACE FUNCTION public.get_company_wellbeing_summary(_company_id uuid)
RETURNS TABLE(
  week_start date,
  total_checkins bigint,
  unique_participants bigint,
  avg_stress numeric,
  avg_sleep numeric,
  avg_workload numeric,
  avg_mood numeric,
  wellbeing_index numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wc.week_start,
    count(*),
    count(DISTINCT wc.user_id),
    round(avg(wc.stress_level)::numeric, 2),
    round(avg(wc.sleep_quality)::numeric, 2),
    round(avg(wc.workload)::numeric, 2),
    round(avg(wc.mood)::numeric, 2),
    round(((avg(wc.mood) + avg(wc.sleep_quality) + (6 - avg(wc.stress_level)) + (6 - avg(wc.workload))) / 4.0)::numeric, 2)
  FROM wellbeing_checkins wc
  WHERE wc.company_id = _company_id
  GROUP BY wc.week_start
  ORDER BY wc.week_start DESC
  LIMIT 12;
$$;
