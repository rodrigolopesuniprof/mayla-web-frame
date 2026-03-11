
-- ESF Teams table
CREATE TABLE public.esf_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE NOT NULL,
  cnes_code text NOT NULL,
  name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  qr_code text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint on cnes_code per municipality
CREATE UNIQUE INDEX esf_teams_cnes_municipality ON public.esf_teams (cnes_code, municipality_id);

-- Add esf_team_id to profiles
ALTER TABLE public.profiles ADD COLUMN esf_team_id uuid REFERENCES public.esf_teams(id);

-- Enable RLS
ALTER TABLE public.esf_teams ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated can view active
CREATE POLICY "Authenticated users can view active ESF teams"
  ON public.esf_teams FOR SELECT TO authenticated
  USING (active = true);

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage ESF teams"
  ON public.esf_teams FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: award 500 points when citizen links to ESF
CREATE OR REPLACE FUNCTION public.award_esf_link_points()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF OLD.esf_team_id IS NULL AND NEW.esf_team_id IS NOT NULL THEN
    NEW.points = OLD.points + 500;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_esf_link_points
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.award_esf_link_points();
