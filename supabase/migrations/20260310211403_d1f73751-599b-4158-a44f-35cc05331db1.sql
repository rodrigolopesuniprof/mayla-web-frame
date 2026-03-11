-- Allow unauthenticated users to view municipalities (needed for city landing page and signup selector)
CREATE POLICY "Anyone can view municipalities"
ON public.municipalities
FOR SELECT
TO anon
USING (true);

-- Update handle_new_user to save municipality_id from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, municipality_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'cpf',
    CASE 
      WHEN NEW.raw_user_meta_data->>'municipality_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'municipality_id')::uuid 
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$$;