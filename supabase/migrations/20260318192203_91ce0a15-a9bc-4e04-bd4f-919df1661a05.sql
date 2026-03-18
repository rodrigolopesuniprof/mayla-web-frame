
-- 1. Insert the 9 orphan profiles with real UUIDs
INSERT INTO public.profiles (user_id, full_name, cpf, company_id) VALUES
  ('30fd817b-ea0c-43eb-9fa3-1d0e01288801', 'Machado de Assis', '01223887634', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('1d843b6c-a860-4157-87a7-a465637a82f8', 'Leonardo Achtschin', '61942332653', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('bf5089e1-0121-428e-979c-3ec861657f9f', 'Naiva Souza', '05475591601', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('65a42204-9ac5-4cd9-8778-8a40872f8ea9', 'Sandra ciraudo', '03405431751', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('8bfb6ff5-c038-42c8-93cb-00881ea60ecc', 'Luiz Fernando Alves Ferreira', '95086480744', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('2b40b1e0-97e6-4171-b44b-0875ba791707', 'Jose da Silva', '12634567890', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('430b6c87-921c-434d-bb89-1b4838b60ae7', 'João Lopes', NULL, 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('66da7442-2ebd-4a08-87ea-f3d566767965', 'VITORIA SOFIA BRANDAO NISHIKAUA LOPES', '09980420642', 'cadab8a8-7507-4351-8b3f-08861ea33f5c'),
  ('910b6bb8-6cae-4c0e-ab8b-8cc97927e316', 'Natalia Dias', '06509496682', 'cadab8a8-7507-4351-8b3f-08861ea33f5c')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Recreate handle_new_user with error handling and ON CONFLICT
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, municipality_id, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cpf',
    CASE 
      WHEN NEW.raw_user_meta_data->>'municipality_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'municipality_id')::uuid 
      ELSE NULL 
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'company_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'company_id')::uuid 
      ELSE NULL 
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
