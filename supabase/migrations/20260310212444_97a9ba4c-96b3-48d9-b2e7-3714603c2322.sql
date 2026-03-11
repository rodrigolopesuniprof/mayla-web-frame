-- Add telemedicine_url and ubs_email to municipalities
ALTER TABLE public.municipalities ADD COLUMN IF NOT EXISTS telemedicine_url text DEFAULT NULL;
ALTER TABLE public.municipalities ADD COLUMN IF NOT EXISTS ubs_email text DEFAULT NULL;

-- Create specialties table (per municipality)
CREATE TABLE public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text DEFAULT '🩺',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage specialties"
ON public.specialties FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active specialties"
ON public.specialties FOR SELECT TO authenticated
USING (active = true);

-- Create appointment_slots table
CREATE TABLE public.appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id uuid NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_bookings integer NOT NULL DEFAULT 1,
  current_bookings integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage appointment slots"
ON public.appointment_slots FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view available slots"
ON public.appointment_slots FOR SELECT TO authenticated
USING (active = true AND current_bookings < max_bookings AND slot_date >= CURRENT_DATE);

-- Update appointments table: add slot reference and municipality
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.appointment_slots(id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id);

-- Allow admins to view all appointments
CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Function to increment booking count when appointment is created
CREATE OR REPLACE FUNCTION public.increment_slot_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL THEN
    UPDATE public.appointment_slots
    SET current_bookings = current_bookings + 1
    WHERE id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_slot_booking
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.increment_slot_booking();

-- Function to decrement booking count when appointment is cancelled
CREATE OR REPLACE FUNCTION public.decrement_slot_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.slot_id IS NOT NULL AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.appointment_slots
    SET current_bookings = GREATEST(current_bookings - 1, 0)
    WHERE id = OLD.slot_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_slot_booking
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.decrement_slot_booking();