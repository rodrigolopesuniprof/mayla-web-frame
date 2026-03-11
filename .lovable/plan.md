

# Plan: Extend User Roles for Corporate Domain

## Current State
- Enum `app_role` has 3 values: `admin`, `manager`, `user`
- `has_role()` security definer function checks roles
- Role checks in code use string matching (`.eq("role", "admin")`)
- RLS policies reference `has_role(auth.uid(), 'admin'::app_role)` and `has_role(auth.uid(), 'manager'::app_role)`

## Changes

### 1. Database Migration

**Extend `app_role` enum** with 4 new values:
```sql
ALTER TYPE public.app_role ADD VALUE 'company_admin';
ALTER TYPE public.app_role ADD VALUE 'hr_manager';
ALTER TYPE public.app_role ADD VALUE 'wellbeing_manager';
ALTER TYPE public.app_role ADD VALUE 'employee';
```

**Create helper functions** for corporate role checks (avoids repeating complex queries in RLS):
- `is_company_admin(uuid)` — checks company_admin or admin
- `is_hr_manager(uuid)` — checks hr_manager
- `is_wellbeing_manager(uuid)` — checks wellbeing_manager

**Create aggregated health view** — HR managers see only aggregated data, never individual records:
```sql
CREATE VIEW public.company_health_summary
WITH (security_invoker=on) AS
SELECT 
  p.company_id,
  count(DISTINCT hm.user_id) as active_users,
  avg(hm.heart_rate) as avg_heart_rate,
  avg(hm.stress_level) as avg_stress_level,
  avg(hm.spo2) as avg_spo2,
  date_trunc('week', hm.measured_at) as week
FROM health_measurements hm
JOIN profiles p ON p.user_id = hm.user_id
WHERE p.company_id IS NOT NULL
GROUP BY p.company_id, date_trunc('week', hm.measured_at);
```

**Add RLS policies** for new roles on key tables:
- `profiles`: company_admin can view/update profiles in their company
- `notifications`: wellbeing_manager can manage notifications for their company
- `missions`: wellbeing_manager can manage missions
- `health_measurements`: NO access for hr_manager (aggregated view only)
- `appointments`: company_admin can view company appointments

### 2. Update RLS Policies

Add policies for corporate roles on these tables:
- **profiles**: company_admin SELECT/UPDATE where `company_id = get_user_company_id(auth.uid())`
- **notifications**: wellbeing_manager ALL where `company_id = get_user_company_id(auth.uid())`
- **missions**: wellbeing_manager ALL (global for now, can scope to company later)
- **support_teams**: company_admin ALL where `company_id = get_user_company_id(auth.uid())`
- **company_locations**: company_admin ALL where `company_id = get_user_company_id(auth.uid())`
- **companies**: company_admin UPDATE where `id = get_user_company_id(auth.uid())`

### 3. Code Updates

**CompanyDashboard.tsx** and **MunicipalDashboard.tsx**: Accept `company_admin`, `hr_manager`, `wellbeing_manager` in addition to `manager`/`admin` for access checks.

**import-users edge function**: Allow assigning `employee` role (currently assigns `user`).

**AdminLogin.tsx / Admin.tsx**: Keep admin-only. Corporate roles access via `/painel/:slug`.

### 4. Privacy Enforcement

- `hr_manager` gets access ONLY to `company_health_summary` view — never to `health_measurements` or `special_measurements` directly
- No RLS policy grants `hr_manager` SELECT on individual measurement tables
- `employee` role mirrors current `user` permissions (own data only)

---

## Files Changed
- 1 SQL migration (enum extension + helper functions + view + RLS policies)
- `src/pages/CompanyDashboard.tsx` — accept new roles
- `src/pages/MunicipalDashboard.tsx` — accept new roles
- `supabase/functions/import-users/index.ts` — use `employee` role

