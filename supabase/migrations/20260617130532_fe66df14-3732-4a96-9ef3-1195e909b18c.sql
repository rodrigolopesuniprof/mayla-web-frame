
-- Indexes to relieve DB load and reduce auth timeouts

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_municipality_id ON public.profiles(municipality_id);

CREATE INDEX IF NOT EXISTS idx_notifications_company_active ON public.notifications(company_id, active, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON public.notifications(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_scope_created ON public.notifications(scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_scores_user_generated ON public.health_scores(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_measurements_user_measured ON public.special_measurements(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user_created ON public.points_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_ledger_company_created ON public.points_ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
