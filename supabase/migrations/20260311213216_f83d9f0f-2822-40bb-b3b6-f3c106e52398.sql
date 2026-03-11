-- Backfill profiles for existing auth users who don't have one yet
INSERT INTO public.profiles (user_id, full_name, cpf, municipality_id, company_id)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  u.raw_user_meta_data->>'cpf',
  CASE 
    WHEN u.raw_user_meta_data->>'municipality_id' IS NOT NULL 
    THEN (u.raw_user_meta_data->>'municipality_id')::uuid 
    ELSE NULL 
  END,
  CASE 
    WHEN u.raw_user_meta_data->>'company_id' IS NOT NULL 
    THEN (u.raw_user_meta_data->>'company_id')::uuid 
    ELSE NULL 
  END
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT DO NOTHING;