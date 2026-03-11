
-- Add health_unit_id and professional_name to appointment_slots
ALTER TABLE public.appointment_slots
ADD COLUMN health_unit_id uuid REFERENCES public.health_units(id),
ADD COLUMN professional_name text;

-- Create appointment_reminders table
CREATE TABLE public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders"
ON public.appointment_reminders
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: when appointment status changes to 'confirmed', create personal notification
CREATE OR REPLACE FUNCTION public.notify_appointment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.notifications (
      title, body, emoji, scope, target_user_id, municipality_id, created_by, color
    )
    VALUES (
      'Consulta confirmada! ✅',
      'Sua consulta de ' || NEW.specialty || ' no dia ' || to_char(NEW.appointment_date, 'DD/MM/YYYY') || ' foi confirmada pela unidade de saúde.',
      '✅',
      'personal',
      NEW.user_id,
      NEW.municipality_id,
      NEW.user_id,
      '142 71% 45%'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_appointment_confirmed
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_confirmed();
