
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  emoji text DEFAULT '📢',
  color text DEFAULT '204 67% 32%',
  external_url text,
  scope text NOT NULL DEFAULT 'municipal',
  municipality_id uuid REFERENCES public.municipalities(id) ON DELETE CASCADE,
  target_user_id uuid,
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admin full CRUD
CREATE POLICY "Admins can manage notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can SELECT active notifications for their municipality or targeted to them
CREATE POLICY "Users can view relevant notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    (scope = 'municipal' AND target_user_id IS NULL AND municipality_id IN (
      SELECT municipality_id FROM public.profiles WHERE user_id = auth.uid()
    ))
    OR
    (scope = 'personal' AND target_user_id = auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
