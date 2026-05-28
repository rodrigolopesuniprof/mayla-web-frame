-- Seed profile_complete rule for existing companies
INSERT INTO public.point_rules (company_id, event_key, label, description, emoji, points, cap_per_week, cap_lifetime)
SELECT c.id, 'profile_complete', 'Cadastro completo', 'Bônus único por preencher dados pessoais obrigatórios', '📋', 150, NULL, 1
FROM public.companies c
ON CONFLICT (company_id, event_key) DO NOTHING;

-- Update seed function so new companies get it too
CREATE OR REPLACE FUNCTION public.seed_default_point_rules(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.point_rules (company_id, event_key, label, description, emoji, points, cap_per_week, cap_lifetime)
  VALUES
    (_company_id, 'avatar_dicebear',      'Personalizar avatar',         'Pontos por criar/atualizar avatar', '🧑‍🎨', 150, NULL, 1),
    (_company_id, 'rppg_measurement',     'Medição rPPG',                'Pontos por concluir medição rápida', '📷', 50,  5,    NULL),
    (_company_id, 'vitals_measurement',   'Medição Vitals completa',     'Pontos por medição especial (PA, hemoglobina, HRV)', '❤️', 100, 3,    NULL),
    (_company_id, 'weekly_checkin',       'Check-in semanal',            'Pontos por responder o check-in da semana', '📝', 50, 1, NULL),
    (_company_id, 'mission_complete',     'Missão concluída',            'Pontos base de missão (a missão pode adicionar)', '🎯', 0, NULL, NULL),
    (_company_id, 'daily_challenge',      'Desafio do dia',              'Pontos por completar desafio diário', '⚡', 0, 7, NULL),
    (_company_id, 'esf_link',             'Vínculo de equipe ESF',       'Pontos por vincular-se à equipe ESF', '🏥', 500, NULL, 1),
    (_company_id, 'support_team_link',    'Adesão a time',               'Pontos por aderir a um time colaborativo', '🤝', 500, NULL, 1),
    (_company_id, 'survey_complete',      'Pesquisa respondida',         'Pontos por responder pesquisa/questionário', '📋', 100, 5, NULL),
    (_company_id, 'medication_adherence', 'Adesão a medicamento',        'Pontos por check-in diário de medicamento', '💊', 100, 7, NULL),
    (_company_id, 'self_assessment',      'Autoavaliação concluída',     'Pontos por completar a autoavaliação inicial', '🩺', 200, NULL, 1),
    (_company_id, 'profile_complete',     'Cadastro completo',           'Bônus único por preencher dados pessoais obrigatórios', '📋', 150, NULL, 1)
  ON CONFLICT (company_id, event_key) DO NOTHING;
END;
$function$;