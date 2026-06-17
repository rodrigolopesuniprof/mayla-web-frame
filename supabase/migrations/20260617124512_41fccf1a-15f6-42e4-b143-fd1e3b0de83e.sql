
-- 1) Catálogo global
CREATE TABLE public.vitals_indicators_catalog (
  key text PRIMARY KEY,
  label text NOT NULL,
  unit text,
  category text NOT NULL DEFAULT 'other',
  description text,
  providers text[] NOT NULL DEFAULT ARRAY['shenai']::text[],
  default_visible_to_user boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vitals_indicators_catalog TO anon, authenticated;
GRANT ALL ON public.vitals_indicators_catalog TO service_role;
ALTER TABLE public.vitals_indicators_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read indicators catalog"
  ON public.vitals_indicators_catalog FOR SELECT
  USING (true);

CREATE POLICY "Only admins manage catalog"
  ON public.vitals_indicators_catalog FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vitals_catalog_updated_at
  BEFORE UPDATE ON public.vitals_indicators_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Visibilidade global (super admin)
CREATE TABLE public.user_visible_indicators (
  indicator_key text PRIMARY KEY REFERENCES public.vitals_indicators_catalog(key) ON DELETE CASCADE,
  visible_to_user boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.user_visible_indicators TO anon, authenticated;
GRANT ALL ON public.user_visible_indicators TO service_role;
ALTER TABLE public.user_visible_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visibility"
  ON public.user_visible_indicators FOR SELECT
  USING (true);

CREATE POLICY "Only admins manage visibility"
  ON public.user_visible_indicators FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_visible_indicators_updated_at
  BEFORE UPDATE ON public.user_visible_indicators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Seed
INSERT INTO public.vitals_indicators_catalog (key, label, unit, category, description, providers, default_visible_to_user, sort_order) VALUES
  ('heart_rate_bpm','Frequência cardíaca','bpm','cardiac','Batimentos por minuto', ARRAY['shenai','binah'], true, 10),
  ('hrv_sdnn_ms','HRV (SDNN)','ms','hrv','Variabilidade da frequência cardíaca (SDNN)', ARRAY['shenai','binah'], true, 20),
  ('hrv_lnrmssd_ms','HRV (lnRMSSD)','ms','hrv','Log natural do RMSSD', ARRAY['shenai'], false, 21),
  ('rmssd_ms','RMSSD','ms','hrv','Root mean square of successive differences', ARRAY['shenai'], false, 22),
  ('mean_rri_ms','RRi médio','ms','hrv','Intervalo RR médio', ARRAY['shenai'], false, 23),
  ('lf_hf_ratio','LF/HF','ratio','hrv','Razão baixa/alta frequência', ARRAY['shenai'], false, 24),
  ('pns_index','PNS Index','idx','hrv','Índice parassimpático', ARRAY['shenai'], false, 25),
  ('sns_index','SNS Index','idx','hrv','Índice simpático', ARRAY['shenai'], false, 26),
  ('breathing_rate_bpm','Frequência respiratória','rpm','respiratory','Respirações por minuto', ARRAY['shenai','binah'], true, 30),
  ('spo2_percent','SpO₂','%','respiratory','Saturação de oxigênio', ARRAY['shenai','binah'], true, 31),
  ('systolic_blood_pressure_mmhg','Pressão sistólica','mmHg','cardiac','Pressão arterial sistólica', ARRAY['shenai','binah'], true, 40),
  ('diastolic_blood_pressure_mmhg','Pressão diastólica','mmHg','cardiac','Pressão arterial diastólica', ARRAY['shenai','binah'], true, 41),
  ('mean_arterial_pressure_mmhg','Pressão arterial média','mmHg','cardiac','MAP', ARRAY['shenai'], false, 42),
  ('pulse_pressure_mmhg','Pressão de pulso','mmHg','cardiac','Sistólica - diastólica', ARRAY['shenai'], false, 43),
  ('cardiac_workload','Carga cardíaca','idx','cardiac','Esforço cardíaco estimado', ARRAY['shenai'], false, 44),
  ('cardiac_output_lpm','Débito cardíaco','L/min','cardiac','Volume bombeado por minuto', ARRAY['shenai'], false, 45),
  ('stroke_volume_ml','Volume sistólico','ml','cardiac','Volume por batimento', ARRAY['shenai'], false, 46),
  ('vascular_age_years','Idade vascular','anos','risk','Idade arterial estimada', ARRAY['shenai'], false, 50),
  ('vascular_stiffness','Rigidez vascular','idx','risk','Stiffness arterial', ARRAY['shenai'], false, 51),
  ('hemoglobin_g_dl','Hemoglobina','g/dL','metabolic','Hemoglobina estimada', ARRAY['shenai','binah'], false, 60),
  ('hemoglobin_a1c_percent','HbA1c','%','metabolic','Hemoglobina glicada estimada', ARRAY['shenai'], false, 61),
  ('glucose_mg_dl','Glicose','mg/dL','metabolic','Glicemia estimada', ARRAY['shenai'], false, 62),
  ('cholesterol_total_mg_dl','Colesterol total','mg/dL','metabolic','Colesterol total estimado', ARRAY['shenai'], false, 63),
  ('triglycerides_mg_dl','Triglicérides','mg/dL','metabolic','Triglicérides estimado', ARRAY['shenai'], false, 64),
  ('bmi_kg_m2','IMC','kg/m²','body','Índice de massa corporal', ARRAY['shenai'], false, 70),
  ('weight_kg','Peso','kg','body','Peso corporal', ARRAY['shenai'], false, 71),
  ('height_cm','Altura','cm','body','Estatura', ARRAY['shenai'], false, 72),
  ('age_years','Idade','anos','body','Idade biológica estimada', ARRAY['shenai'], false, 73),
  ('waist_to_height_ratio','Cintura/altura','ratio','body','Indicador antropométrico', ARRAY['shenai'], false, 74),
  ('stress_index','Índice de estresse','idx','stress','Estresse fisiológico', ARRAY['shenai','binah'], true, 80),
  ('parasympathetic_activity','Atividade parassimpática','%','stress','Tônus vagal estimado', ARRAY['shenai'], false, 81),
  ('wellness_score','Score de bem-estar','idx','wellness','Score consolidado de bem-estar', ARRAY['shenai'], true, 90),
  ('mental_score','Score mental','idx','wellness','Saúde mental estimada', ARRAY['shenai'], false, 91),
  ('cardiovascular_risk_score','Risco cardiovascular','%','risk','Risco CV estimado', ARRAY['shenai'], false, 100),
  ('hypertension_risk','Risco de hipertensão','%','risk','Probabilidade de hipertensão', ARRAY['shenai'], false, 101),
  ('diabetic_risk','Risco de diabetes','%','risk','Probabilidade de diabetes', ARRAY['shenai'], false, 102)
ON CONFLICT (key) DO NOTHING;

-- Seed visibilidade padrão (mantém comportamento atual)
INSERT INTO public.user_visible_indicators (indicator_key, visible_to_user)
SELECT key, default_visible_to_user FROM public.vitals_indicators_catalog
ON CONFLICT (indicator_key) DO NOTHING;
