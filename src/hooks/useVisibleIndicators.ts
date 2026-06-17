import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IndicatorMeta {
  key: string;
  label: string;
  unit: string | null;
  category: string;
  description: string | null;
  providers: string[];
  default_visible_to_user: boolean;
  sort_order: number;
  active: boolean;
  visible_to_user: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  cardiac: "Cardiovascular",
  hrv: "Variabilidade (HRV)",
  respiratory: "Respiratório",
  metabolic: "Metabólico",
  body: "Antropometria",
  stress: "Estresse",
  risk: "Risco clínico",
  wellness: "Bem-estar",
  other: "Outros",
};

export function categoryLabel(c: string) {
  return CATEGORY_LABELS[c] || c;
}

export function useVisibleIndicators() {
  const [indicators, setIndicators] = useState<IndicatorMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, visRes] = await Promise.all([
      supabase.from("vitals_indicators_catalog" as any).select("*").eq("active", true).order("sort_order"),
      supabase.from("user_visible_indicators" as any).select("indicator_key, visible_to_user"),
    ]);
    const visMap = new Map<string, boolean>();
    (visRes.data as any[] | null)?.forEach((r) => visMap.set(r.indicator_key, r.visible_to_user));
    const list: IndicatorMeta[] = ((catRes.data as any[]) || []).map((c) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      category: c.category,
      description: c.description,
      providers: c.providers || [],
      default_visible_to_user: c.default_visible_to_user,
      sort_order: c.sort_order,
      active: c.active,
      visible_to_user: visMap.has(c.key) ? !!visMap.get(c.key) : !!c.default_visible_to_user,
    }));
    setIndicators(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isVisible = useCallback((key: string) => {
    const ind = indicators.find((i) => i.key === key);
    return ind ? ind.visible_to_user : false;
  }, [indicators]);

  const visible = indicators.filter((i) => i.visible_to_user);

  return { indicators, visible, isVisible, loading, reload: load };
}

/** Extract a flat key→value map from a measurement_data jsonb payload (Shen.ai or Binah). */
export function flattenMeasurementPayload(payload: any): Record<string, number | string> {
  if (!payload || typeof payload !== "object") return {};
  // Shen.ai shape: { provider: "shenai", payload: {...} }
  const src = payload.payload && typeof payload.payload === "object" ? payload.payload : payload;
  const out: Record<string, number | string> = {};

  const direct: Record<string, string> = {
    heart_rate_bpm: "heart_rate_bpm",
    hrv_sdnn_ms: "hrv_sdnn_ms",
    hrv_lnrmssd_ms: "hrv_lnrmssd_ms",
    rmssd_ms: "rmssd_ms",
    mean_rri_ms: "mean_rri_ms",
    lf_hf_ratio: "lf_hf_ratio",
    pns_index: "pns_index",
    sns_index: "sns_index",
    breathing_rate_bpm: "breathing_rate_bpm",
    spo2_percent: "spo2_percent",
    systolic_blood_pressure_mmhg: "systolic_blood_pressure_mmhg",
    diastolic_blood_pressure_mmhg: "diastolic_blood_pressure_mmhg",
    mean_arterial_pressure_mmhg: "mean_arterial_pressure_mmhg",
    pulse_pressure_mmhg: "pulse_pressure_mmhg",
    cardiac_workload_mmhg_per_sec: "cardiac_workload",
    cardiac_workload: "cardiac_workload",
    cardiac_output_lpm: "cardiac_output_lpm",
    stroke_volume_ml: "stroke_volume_ml",
    vascular_age_years: "vascular_age_years",
    vascular_stiffness: "vascular_stiffness",
    hemoglobin_g_dl: "hemoglobin_g_dl",
    hemoglobin_a1c_percent: "hemoglobin_a1c_percent",
    glucose_mg_dl: "glucose_mg_dl",
    cholesterol_total_mg_dl: "cholesterol_total_mg_dl",
    triglycerides_mg_dl: "triglycerides_mg_dl",
    bmi_kg_m2: "bmi_kg_m2",
    weight_kg: "weight_kg",
    height_cm: "height_cm",
    age_years: "age_years",
    waist_to_height_ratio: "waist_to_height_ratio",
    stress_index: "stress_index",
    parasympathetic_activity: "parasympathetic_activity",
    wellness_score: "wellness_score",
    mental_score: "mental_score",
    cardiovascular_risk_score: "cardiovascular_risk_score",
    hypertension_risk: "hypertension_risk",
    diabetic_risk: "diabetic_risk",
  };

  for (const [k, target] of Object.entries(direct)) {
    const v = src[k];
    if (v != null && v !== "") out[target] = typeof v === "object" && "value" in v ? v.value : v;
  }

  // Legacy keys from BinahCapture's mapped result
  const legacy: Record<string, string> = {
    heart_rate: "heart_rate_bpm",
    respiratory_rate: "breathing_rate_bpm",
    stress_level: "stress_index",
    hrv_sdnn: "hrv_sdnn_ms",
    blood_pressure_sys: "systolic_blood_pressure_mmhg",
    blood_pressure_dia: "diastolic_blood_pressure_mmhg",
    spo2: "spo2_percent",
    wellness_score: "wellness_score",
    hemoglobin: "hemoglobin_g_dl",
    hba1c: "hemoglobin_a1c_percent",
    prq: "pulse_pressure_mmhg",
    cardiac_workload: "cardiac_workload",
  };
  for (const [k, target] of Object.entries(legacy)) {
    if (out[target] == null && src[k] != null && src[k] !== "") out[target] = src[k];
  }
  return out;
}
