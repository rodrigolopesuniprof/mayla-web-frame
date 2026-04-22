
-- =========================================
-- Assistant Conversations
-- =========================================
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  message_count int NOT NULL DEFAULT 0,
  topic_tags text[] DEFAULT '{}',
  health_context_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conv_user ON public.assistant_conversations(user_id, last_message_at DESC);
CREATE INDEX idx_assistant_conv_company ON public.assistant_conversations(company_id);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
  ON public.assistant_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own conversations"
  ON public.assistant_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own conversations"
  ON public.assistant_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all conversations"
  ON public.assistant_conversations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Company admins read company conversations"
  ON public.assistant_conversations FOR SELECT
  USING (public.is_company_admin(auth.uid()) AND company_id = public.get_user_company_id(auth.uid()));

CREATE TRIGGER update_assistant_conv_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Assistant Messages
-- =========================================
CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tokens_in int,
  tokens_out int,
  model text,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_msg_conv ON public.assistant_messages(conversation_id, created_at);

ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own messages"
  ON public.assistant_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users insert own messages"
  ON public.assistant_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Admins read all messages"
  ON public.assistant_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Assistant Feedback
-- =========================================
CREATE TABLE public.assistant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_assistant_feedback_msg ON public.assistant_feedback(message_id);

ALTER TABLE public.assistant_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
  ON public.assistant_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all feedback"
  ON public.assistant_feedback FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Assistant Safety Flags
-- =========================================
CREATE TABLE public.assistant_safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN ('diagnosis_attempt', 'prescription_attempt', 'critical_indicator', 'escalate_to_doctor')),
  details jsonb,
  reviewed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_safety_flags_unreviewed ON public.assistant_safety_flags(reviewed, created_at DESC);

ALTER TABLE public.assistant_safety_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read safety flags"
  ON public.assistant_safety_flags FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update safety flags"
  ON public.assistant_safety_flags FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================
-- Health Articles (Magazine)
-- =========================================
CREATE TABLE public.health_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  cover_image_url text,
  excerpt text,
  content_markdown text NOT NULL,
  tags text[] DEFAULT '{}',
  target_conditions text[] DEFAULT '{}',
  reading_time_minutes int,
  author_name text,
  published_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_articles_active ON public.health_articles(is_active, published_at DESC);
CREATE INDEX idx_health_articles_tags ON public.health_articles USING GIN(tags);

ALTER TABLE public.health_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read active articles"
  ON public.health_articles FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage articles"
  ON public.health_articles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_health_articles_updated_at
  BEFORE UPDATE ON public.health_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Health Article Views (telemetry)
-- =========================================
CREATE TABLE public.health_article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  article_id uuid NOT NULL REFERENCES public.health_articles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  read_duration_seconds int,
  completed boolean DEFAULT false
);

CREATE INDEX idx_article_views_user ON public.health_article_views(user_id, viewed_at DESC);
CREATE INDEX idx_article_views_article ON public.health_article_views(article_id);

ALTER TABLE public.health_article_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own views"
  ON public.health_article_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own views"
  ON public.health_article_views FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own views"
  ON public.health_article_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all views"
  ON public.health_article_views FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
