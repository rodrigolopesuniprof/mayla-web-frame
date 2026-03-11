
-- Table: municipality_features (feature flags per municipality)
CREATE TABLE public.municipality_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(municipality_id, feature_key)
);

ALTER TABLE public.municipality_features ENABLE ROW LEVEL SECURITY;

-- Admins can manage features
CREATE POLICY "Admins can manage municipality features"
ON public.municipality_features FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read features (needed to check if binah is enabled)
CREATE POLICY "Authenticated can view features"
ON public.municipality_features FOR SELECT TO authenticated
USING (true);

-- Table: special_measurements (Binah results)
CREATE TABLE public.special_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  municipality_id uuid REFERENCES public.municipalities(id),
  measurement_data jsonb NOT NULL DEFAULT '{}',
  source text DEFAULT 'binah',
  measured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.special_measurements ENABLE ROW LEVEL SECURITY;

-- Users can insert their own
CREATE POLICY "Users can insert own special measurements"
ON public.special_measurements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own
CREATE POLICY "Users can view own special measurements"
ON public.special_measurements FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all special measurements"
ON public.special_measurements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
