
-- Step 1: Extend app_role enum with corporate roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'wellbeing_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';
