import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SurveyData {
  biological_sex: string;
  birth_date: Date | undefined;
  is_pregnant: string;
  prenatal_started: boolean;
  has_hypertension: boolean;
  has_diabetes: boolean;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  numero: string;
  complemento: string;
  peso: string;
  altura: string;
  mental_mood: number;
  mental_anxiety: number;
  mental_stress: number;
  mental_sleep: number;
  mental_social: number;
}

function getAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function computeTags(data: SurveyData): string[] {
  const tags: string[] = ["GERAL"];
  const age = data.birth_date ? getAge(data.birth_date) : 30;

  if (data.biological_sex === "female" && data.is_pregnant === "yes") {
    tags.push("TAG_GESTANTE");
  }
  if (data.has_hypertension || data.has_diabetes) {
    tags.push("TAG_CRONICO");
  }
  if (data.biological_sex === "female" && age >= 25 && age <= 64) {
    tags.push("TAG_MULHER_PREVENCAO");
  }
  // Mental health tag
  if (data.mental_mood <= 2 || data.mental_anxiety >= 4 || data.mental_stress >= 4) {
    tags.push("TAG_SAUDE_MENTAL");
  }
  return tags;
}

const MENTAL_STEPS: {
  key: string;
  category: string;
  question: string;
  field: keyof SurveyData;
  options: { emoji: string; label: string; value: number }[];
}[] = [
  {
    key: "mental_mood",
    category: "HUMOR",
    question: "Nas últimas 2 semanas, você se sentiu desanimado ou sem esperança?",
    field: "mental_mood",
    options: [
      { emoji: "😭", label: "Sempre", value: 1 },
      { emoji: "😢", label: "Frequente", value: 2 },
      { emoji: "😐", label: "Às vezes", value: 3 },
      { emoji: "🙂", label: "Raramente", value: 4 },
      { emoji: "😊", label: "Nunca", value: 5 },
    ],
  },
  {
    key: "mental_anxiety",
    category: "ANSIEDADE",
    question: "Você se sentiu nervoso ou ansioso hoje?",
    field: "mental_anxiety",
    options: [
      { emoji: "😰", label: "Muito", value: 1 },
      { emoji: "😟", label: "Bastante", value: 2 },
      { emoji: "😐", label: "Moderado", value: 3 },
      { emoji: "🙂", label: "Pouco", value: 4 },
      { emoji: "😌", label: "Nada", value: 5 },
    ],
  },
  {
    key: "mental_stress",
    category: "ESTRESSE",
    question: "Você sentiu que as coisas estavam fora do seu controle?",
    field: "mental_stress",
    options: [
      { emoji: "🤯", label: "Completo", value: 1 },
      { emoji: "😣", label: "Bastante", value: 2 },
      { emoji: "😐", label: "Moderado", value: 3 },
      { emoji: "🙂", label: "Pouco", value: 4 },
      { emoji: "😎", label: "Nada", value: 5 },
    ],
  },
  {
    key: "mental_sleep",
    category: "SONO",
    question: "Como você dormiu na última noite?",
    field: "mental_sleep",
    options: [
      { emoji: "😵", label: "Muito mal", value: 1 },
      { emoji: "😴", label: "Mal", value: 2 },
      { emoji: "😐", label: "Regular", value: 3 },
      { emoji: "🙂", label: "Bem", value: 4 },
      { emoji: "😊", label: "Muito bem", value: 5 },
    ],
  },
  {
    key: "mental_social",
    category: "SUPORTE SOCIAL",
    question: "Você sente que tem pessoas com quem pode contar quando precisa?",
    field: "mental_social",
    options: [
      { emoji: "😔", label: "Nenhuma", value: 1 },
      { emoji: "😕", label: "Quase", value: 2 },
      { emoji: "😐", label: "Algumas", value: 3 },
      { emoji: "🙂", label: "Sim", value: 4 },
      { emoji: "🥰", label: "Sim, muito", value: 5 },
    ],
  },
];

export function HealthSurvey({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [birthInput, setBirthInput] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [detectedMunicipalityId, setDetectedMunicipalityId] = useState<string | null>(null);
  const [data, setData] = useState<SurveyData>({
    biological_sex: "",
    birth_date: undefined,
    is_pregnant: "",
    prenatal_started: false,
    has_hypertension: false,
    has_diabetes: false,
    cep: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    numero: "",
    complemento: "",
    peso: "",
    altura: "",
    mental_mood: 0,
    mental_anxiety: 0,
    mental_stress: 0,
    mental_sleep: 0,
    mental_social: 0,
  });

  const fetchCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const json = await res.json();
      if (!json.erro) {
        setData((prev) => ({
          ...prev,
          endereco: json.logradouro || "",
          bairro: json.bairro || "",
          cidade: json.localidade || "",
          estado: json.uf || "",
        }));
        if (json.localidade && json.uf) {
          const { data: muni } = await supabase
            .from("municipalities")
            .select("id")
            .ilike("name", json.localidade)
            .ilike("state", json.uf)
            .limit(1)
            .maybeSingle();
          if (muni) {
            setDetectedMunicipalityId(muni.id);
          } else {
            setDetectedMunicipalityId(null);
          }
        }
      }
    } catch {
      // ignore
    }
    setCepLoading(false);
  };

  // Build dynamic steps
  const steps: { key: string; question: string; subtext?: string; category?: string }[] = [
    { key: "sex", question: "Como você se identifica?", subtext: "Isso nos ajuda a personalizar seus cuidados de saúde" },
    { key: "birth", question: "Qual sua data de nascimento?", subtext: "Usamos para filtrar indicadores de saúde para sua faixa etária" },
  ];

  const age = data.birth_date ? getAge(data.birth_date) : null;
  const isFertileWoman = data.biological_sex === "female" && age !== null && age >= 15 && age <= 49;

  if (isFertileWoman) {
    steps.push({ key: "pregnant", question: "Você está grávida ou suspeita de gravidez?" });
  }
  if (data.is_pregnant === "yes") {
    steps.push({ key: "prenatal", question: "Já iniciou o seu Pré-Natal no postinho?" });
  }
  steps.push({ key: "chronic", question: "Você já recebeu diagnóstico médico de alguma dessas condições?", subtext: "Marque as que se aplicam" });
  steps.push({ key: "address", question: "Qual seu endereço?", subtext: "Digite o CEP para preencher automaticamente" });
  steps.push({ key: "body", question: "Qual seu peso e altura?", subtext: "Informações importantes para acompanhar sua saúde" });

  // Mental health steps
  for (const ms of MENTAL_STEPS) {
    steps.push({ key: ms.key, question: ms.question, category: ms.category });
  }

  const totalSteps = steps.length;
  const currentStep = steps[step];
  const remaining = totalSteps - step - 1;

  const canAdvance = (): boolean => {
    if (!currentStep) return false;
    switch (currentStep.key) {
      case "sex": return !!data.biological_sex;
      case "birth": return !!data.birth_date;
      case "pregnant": return !!data.is_pregnant;
      case "address": return data.cep.replace(/\D/g, "").length === 8 && !!data.endereco?.trim() && !!data.numero?.trim();
      case "body": return !!data.peso && !!data.altura;
      case "mental_mood": return data.mental_mood > 0;
      case "mental_anxiety": return data.mental_anxiety > 0;
      case "mental_stress": return data.mental_stress > 0;
      case "mental_sleep": return data.mental_sleep > 0;
      case "mental_social": return data.mental_social > 0;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);

    const profileUpdate: any = {
      biological_sex: data.biological_sex,
      birth_date: data.birth_date ? format(data.birth_date, "yyyy-MM-dd") : null,
      is_pregnant: data.is_pregnant || null,
      prenatal_started: data.prenatal_started,
      has_hypertension: data.has_hypertension,
      has_diabetes: data.has_diabetes,
      health_survey_completed: true,
      health_survey_completed_at: new Date().toISOString(),
      cep: data.cep.replace(/\D/g, "") || null,
      endereco: data.endereco || null,
      bairro: data.bairro || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      peso: data.peso ? parseFloat(data.peso) : null,
      altura: data.altura ? parseFloat(data.altura) : null,
      mental_mood: data.mental_mood,
      mental_anxiety: data.mental_anxiety,
      mental_stress: data.mental_stress,
      mental_sleep: data.mental_sleep,
      mental_social: data.mental_social,
    };
    if (detectedMunicipalityId) {
      profileUpdate.municipality_id = detectedMunicipalityId;
    }
    await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);

    // Delete existing user_missions to prevent duplicates on retake
    await supabase.from("user_missions").delete().eq("user_id", user.id);

    // Compute tags and assign missions
    const tags = computeTags(data);
    const { data: missions } = await supabase
      .from("missions")
      .select("id, tag")
      .eq("active", true);

    if (missions) {
      const userMissions = missions
        .filter((m: any) => tags.includes(m.tag))
        .map((m: any) => ({
          user_id: user.id,
          mission_id: m.id,
          status: "pending",
        }));

      if (userMissions.length > 0) {
        await supabase.from("user_missions").insert(userMissions as any);
      }
    }

    // Auto-complete "Dados Certos" mission
    const { data: dadosMission } = await supabase
      .from("missions")
      .select("id")
      .ilike("title", "%Dados Certos%")
      .maybeSingle();

    if (dadosMission) {
      await supabase
        .from("user_missions")
        .update({ status: "completed", completed_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .eq("mission_id", dadosMission.id);
    }

    setSaving(false);
    onDone();
  };

  const OptionButton = ({
    label,
    icon,
    selected,
    onClick,
  }: {
    label: string;
    icon: string;
    selected: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl p-5 border-2 text-left flex items-center gap-4 transition-all cursor-pointer",
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-card hover:border-accent/30"
      )}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[15px] font-medium text-foreground">{label}</span>
      {selected && <span className="ml-auto text-accent text-lg">✓</span>}
    </button>
  );

  const MentalScaleCard = ({
    emoji,
    label,
    selected,
    onClick,
  }: {
    emoji: string;
    label: string;
    selected: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all cursor-pointer min-w-0",
        selected
          ? "border-accent bg-accent/10 scale-105 shadow-md"
          : "border-border bg-card hover:border-accent/30"
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <span className={cn(
        "text-[10px] leading-tight text-center font-medium",
        selected ? "text-accent" : "text-muted-foreground"
      )}>{label}</span>
    </button>
  );

  const renderStepContent = () => {
    if (!currentStep) return null;

    // Check if it's a mental health step
    const mentalStep = MENTAL_STEPS.find(ms => ms.key === currentStep.key);
    if (mentalStep) {
      const currentValue = data[mentalStep.field] as number;
      return (
        <div className="flex gap-2">
          {mentalStep.options.map((opt) => (
            <MentalScaleCard
              key={opt.value}
              emoji={opt.emoji}
              label={opt.label}
              selected={currentValue === opt.value}
              onClick={() => setData({ ...data, [mentalStep.field]: opt.value })}
            />
          ))}
        </div>
      );
    }

    switch (currentStep.key) {
      case "sex":
        return (
          <div className="flex flex-col gap-3">
            <OptionButton icon="♂️" label="Masculino" selected={data.biological_sex === "male"} onClick={() => setData({ ...data, biological_sex: "male" })} />
            <OptionButton icon="♀️" label="Feminino" selected={data.biological_sex === "female"} onClick={() => setData({ ...data, biological_sex: "female" })} />
          </div>
        );

      case "birth":
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full">
              <label className="text-[13px] text-muted-foreground mb-2 block">Digite sua data de nascimento</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={data.birth_date ? format(data.birth_date, "dd/MM/yyyy") : birthInput}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                  if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5, 9);
                  setBirthInput(v);
                  if (v.length === 10) {
                    const [dd, mm, yyyy] = v.split("/");
                    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    if (!isNaN(parsed.getTime()) && parsed <= new Date() && parsed >= new Date("1900-01-01")) {
                      setData({ ...data, birth_date: parsed });
                    } else {
                      setData({ ...data, birth_date: undefined });
                    }
                  } else {
                    setData({ ...data, birth_date: undefined });
                  }
                }}
                className="w-full rounded-2xl p-5 border-2 border-border bg-card text-[15px] text-foreground text-center font-medium tracking-widest focus:outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="text-[12px] text-muted-foreground">ou selecione no calendário</div>
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full rounded-2xl p-4 border-2 border-border bg-card text-left flex items-center gap-4 cursor-pointer hover:border-accent/30 transition-all">
                  <span className="text-2xl">📅</span>
                  <span className="text-[14px] text-muted-foreground">
                    {data.birth_date ? format(data.birth_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Abrir calendário"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={data.birth_date}
                  onSelect={(d) => {
                    setData({ ...data, birth_date: d });
                    if (d) setBirthInput(format(d, "dd/MM/yyyy"));
                  }}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  captionLayout="dropdown-buttons"
                  fromYear={1920}
                  toYear={new Date().getFullYear()}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case "pregnant":
        return (
          <div className="flex flex-col gap-3">
            <OptionButton icon="✅" label="Sim" selected={data.is_pregnant === "yes"} onClick={() => setData({ ...data, is_pregnant: "yes" })} />
            <OptionButton icon="❌" label="Não" selected={data.is_pregnant === "no"} onClick={() => setData({ ...data, is_pregnant: "no" })} />
            <OptionButton icon="🤔" label="Não tenho certeza" selected={data.is_pregnant === "unsure"} onClick={() => setData({ ...data, is_pregnant: "unsure" })} />
          </div>
        );

      case "prenatal":
        return (
          <div className="flex flex-col gap-3">
            <OptionButton icon="✅" label="Sim, já iniciei" selected={data.prenatal_started === true} onClick={() => setData({ ...data, prenatal_started: true })} />
            <OptionButton icon="❌" label="Ainda não" selected={data.prenatal_started === false} onClick={() => setData({ ...data, prenatal_started: false })} />
          </div>
        );

      case "chronic":
        return (
          <div className="flex flex-col gap-3">
            <OptionButton
              icon="💓"
              label="Hipertensão (Pressão Alta)"
              selected={data.has_hypertension}
              onClick={() => setData({ ...data, has_hypertension: !data.has_hypertension })}
            />
            <OptionButton
              icon="🩸"
              label="Diabetes"
              selected={data.has_diabetes}
              onClick={() => setData({ ...data, has_diabetes: !data.has_diabetes })}
            />
            <OptionButton
              icon="😊"
              label="Nenhuma das anteriores"
              selected={!data.has_hypertension && !data.has_diabetes}
              onClick={() => setData({ ...data, has_hypertension: false, has_diabetes: false })}
            />
          </div>
        );

      case "address":
        return (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block">CEP</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                value={data.cep}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5, 8);
                  setData({ ...data, cep: v });
                  if (v.replace(/\D/g, "").length === 8) fetchCep(v);
                }}
                className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[15px] text-foreground font-medium tracking-widest focus:outline-none focus:border-accent transition-all"
              />
              {cepLoading && <p className="text-[11px] text-muted-foreground mt-1">Buscando endereço...</p>}
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block">Rua / Logradouro *</label>
              <input
                type="text"
                placeholder="Ex: Rua das Flores"
                value={data.endereco}
                onChange={(e) => setData({ ...data, endereco: e.target.value })}
                className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[13px] text-muted-foreground mb-1.5 block">Número *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Nº"
                  value={data.numero}
                  onChange={(e) => setData({ ...data, numero: e.target.value })}
                  className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-[13px] text-muted-foreground mb-1.5 block">Complemento</label>
                <input
                  type="text"
                  placeholder="Apto, bloco..."
                  value={data.complemento}
                  onChange={(e) => setData({ ...data, complemento: e.target.value })}
                  className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block">Bairro</label>
              <input
                type="text"
                placeholder="Bairro"
                value={data.bairro}
                onChange={(e) => setData({ ...data, bairro: e.target.value })}
                className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[13px] text-muted-foreground mb-1.5 block">Cidade</label>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={data.cidade}
                  onChange={(e) => setData({ ...data, cidade: e.target.value })}
                  className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-[13px] text-muted-foreground mb-1.5 block">UF</label>
                <input
                  type="text"
                  placeholder="UF"
                  maxLength={2}
                  value={data.estado}
                  onChange={(e) => setData({ ...data, estado: e.target.value.toUpperCase() })}
                  className="w-full rounded-2xl p-4 border-2 border-border bg-card text-[14px] text-foreground focus:outline-none focus:border-accent transition-all"
                />
              </div>
            </div>
          </div>
        );

      case "body":
        return (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block">Peso (kg)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 72.5"
                value={data.peso}
                onChange={(e) => setData({ ...data, peso: e.target.value.replace(/[^0-9.,]/g, "") })}
                className="w-full rounded-2xl p-5 border-2 border-border bg-card text-[18px] text-foreground text-center font-medium focus:outline-none focus:border-accent transition-all"
              />
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground mb-1.5 block">Altura (cm)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 165"
                value={data.altura}
                onChange={(e) => setData({ ...data, altura: e.target.value.replace(/[^0-9]/g, "") })}
                className="w-full rounded-2xl p-5 border-2 border-border bg-card text-[18px] text-foreground text-center font-medium focus:outline-none focus:border-accent transition-all"
              />
            </div>
            {data.peso && data.altura && Number(data.altura) > 0 && (
              <div className="text-center text-[13px] text-muted-foreground">
                IMC: <span className="font-semibold text-foreground">
                  {(Number(data.peso.replace(",", ".")) / Math.pow(Number(data.altura) / 100, 2)).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="animate-fade-up flex-1 flex flex-col bg-background relative overflow-hidden">
      {/* Decorative blob */}
      <div
        className="absolute animate-morph"
        style={{
          top: -60, right: -60, width: 200, height: 200,
          background: "radial-gradient(circle, hsl(var(--mayla-teal)), hsl(var(--mayla-pref)))",
          borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
          opacity: 0.12,
        }}
      />

      {/* Progress bar */}
      <div className="px-[22px] pt-[22px] pb-2">
        <div className="h-[5px] rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((step + 1) / totalSteps) * 100}%`,
              background: "linear-gradient(90deg, hsl(var(--mayla-teal)), hsl(var(--mayla-green)))",
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          {remaining > 0 ? `Faltam só ${remaining} pergunta${remaining > 1 ? "s" : ""} para liberar seus primeiros pontos!` : "Última pergunta! 🎉"}
        </p>
      </div>

      {/* Header */}
      <div className="px-[22px] pt-4 pb-2">
        {currentStep?.category && (
          <div className="text-[11px] text-accent tracking-[.2em] uppercase font-bold mb-2">
            {currentStep.category}
          </div>
        )}
        {!currentStep?.category && (
          <div className="text-[10px] text-muted-foreground tracking-[.16em] uppercase mb-2">
            Personalização da sua Jornada
          </div>
        )}
        <h2 className="font-display text-[22px] font-medium text-foreground leading-[1.3] mb-1"
          dangerouslySetInnerHTML={{ __html: currentStep?.question?.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '' }}
        />
        {currentStep?.subtext && (
          <p className="text-[13px] text-muted-foreground">{currentStep.subtext}</p>
        )}
      </div>

      {/* Content */}
      <div key={currentStep?.key} className="flex-1 px-[22px] pt-4 overflow-y-auto animate-fade-up">
        {renderStepContent()}
      </div>

      {/* Footer */}
      <div className="px-7 pb-8 pt-4 flex flex-col items-center gap-3">
        <button
          onClick={handleNext}
          disabled={!canAdvance() || saving}
          className="w-full py-4 rounded-[18px] border-none cursor-pointer font-body text-[15px] font-semibold text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{
            background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
            boxShadow: canAdvance() ? "0 8px 28px rgba(232,87,74,.3)" : "none",
          }}
        >
          {saving ? "Salvando..." : step < totalSteps - 1 ? "Continuar →" : "Finalizar 🎯"}
        </button>
        <div className="flex items-center gap-4">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="bg-transparent border-none text-[13px] text-muted-foreground cursor-pointer"
            >
              ← Voltar
            </button>
          )}
          <button
            onClick={async () => {
              if (!user) return;
              setSaving(true);
              await supabase.from("profiles").update({
                health_survey_completed: true,
                health_survey_completed_at: new Date().toISOString(),
              } as any).eq("user_id", user.id);
              setSaving(false);
              onDone();
            }}
            disabled={saving}
            className="bg-transparent border-none text-[13px] text-muted-foreground cursor-pointer underline"
          >
            Pular questionário
          </button>
        </div>
      </div>
    </div>
  );
}
