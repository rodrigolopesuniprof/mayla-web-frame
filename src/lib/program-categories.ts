export const CATEGORY_LABELS: Record<string, string> = {
  burnout_prevention: "Prevenção de Burnout",
  sleep_improvement: "Melhoria do Sono",
  stress_reduction: "Redução de Estresse",
  physical_activity: "Atividade Física",
  general: "Geral",
};

export const CATEGORY_TAG_MAP: Record<string, string[]> = {
  burnout_prevention: ["saude_mental", "burnout"],
  sleep_improvement: ["sono", "sleep"],
  stress_reduction: ["estresse", "stress"],
  physical_activity: ["exercicio", "atividade_fisica"],
  general: [],
};

export const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
