
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Create municipalities table
CREATE TABLE public.municipalities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ES',
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  secretaria TEXT NOT NULL DEFAULT 'Secretaria Municipal de Saúde',
  rppg_url TEXT DEFAULT 'https://rppg.saudecomvc.com.br/login',
  primary_color TEXT NOT NULL DEFAULT '204 67% 32%',
  accent_color TEXT NOT NULL DEFAULT '5 75% 60%',
  background_color TEXT NOT NULL DEFAULT '30 50% 96%',
  foreground_color TEXT NOT NULL DEFAULT '16 30% 13%',
  secondary_color TEXT NOT NULL DEFAULT '30 25% 89%',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Add municipality_id to profiles
ALTER TABLE public.profiles ADD COLUMN municipality_id UUID REFERENCES public.municipalities(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for municipalities: all authenticated can read
CREATE POLICY "Authenticated users can view municipalities"
ON public.municipalities FOR SELECT TO authenticated
USING (true);

-- Only admins can manage municipalities
CREATE POLICY "Admins can insert municipalities"
ON public.municipalities FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update municipalities"
ON public.municipalities FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete municipalities"
ON public.municipalities FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS for user_roles: users can see own, admins can manage all
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger for municipalities
CREATE TRIGGER update_municipalities_updated_at
  BEFORE UPDATE ON public.municipalities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
