import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreRing } from "./ScoreRing";
import { AlertCard } from "./AlertCard";
import { TrendCard } from "./TrendCard";
import { TimelineItem, TimelineGroup } from "./TimelineItem";
import { ReportBottomNav } from "./ReportBottomNav";
import { InfoSheet, InfoButton } from "./InfoSheet";
import { toast } from "@/hooks/use-toast";
import "./report.css";

const RECOMMENDATION_TEXT: Record<number, { title: string; body: string }> = {
  1: { title: "Tudo dentro do esperado", body: "Seus indicadores estão estáveis e dentro dos padrões habituais. Continue assim!" },
  2: { title: "Vale acompanhar de perto", body: "Alguns indicadores mostraram variações leves na semana. Nada alarmante, mas vale prestar atenção nas próximas medições." },
  3: { title: "Recomendamos uma consulta", body: "Há sinais persistentes que justificam avaliação profissional. Considere agendar uma consulta para revisão." },
  4: { title: "Procure atendimento em breve", body: "Combinação de indicadores fora do padrão sugere necessidade de avaliação clínica em breve." },
};

const INFO_TEXTS: Record<string, { title: string; desc: string; details?: { label: string; value: string }[] }> = {
  score: {
    title: "Score geral",
    desc: "Média ponderada dos seus indicadores de saúde dos últimos 7 dias.\n\n• 40% Fisiológico — baseado nos sinais vitais medidos (FC, SpO2, PA, Respiração, HRV, Hemoglobina, HbA1c)\n• 30% Emocional — nível de estresse medido via câmera\n• 30% Estilo de vida — atualmente sem fontes conectadas (sono/passos), valor padrão aplicado",
    details: [
      { label: "Fisiológico", value: "40%" },
      { label: "Emocional", value: "30%" },
      { label: "Estilo de vida", value: "30%" },
    ],
  },
  hr: { title: "Frequência Cardíaca", desc: "Batimentos cardíacos por minuto, medidos via câmera (rPPG).\n\nFaixa ideal em repouso: 60 – 100 bpm.\nAbaixo de 60 pode indicar bradicardia; acima de 100, taquicardia." },
  stress: { title: "Nível de Estresse", desc: "Calculado a partir da variabilidade da frequência cardíaca via câmera.\n\nVaria de 0 a 100. Abaixo de 40 é considerado baixo; acima de 70 é elevado." },
  spo2: { title: "Saturação de Oxigênio (SpO2)", desc: "Porcentagem de oxigênio no sangue, estimada pela câmera.\n\nFaixa ideal: 95 – 100%. Abaixo de 95% merece atenção clínica." },
  bp: { title: "Pressão Arterial", desc: "Pressão sistólica/diastólica estimada pela câmera.\n\nFaixa ideal: 90/60 – 120/80 mmHg.\nAcima de 140/90 indica hipertensão." },
  rr: { title: "Frequência Respiratória", desc: "Ciclos respiratórios por minuto.\n\nFaixa ideal: 12 – 20 rpm." },
  hrv: { title: "HRV (SDNN)", desc: "Variabilidade da frequência cardíaca. Mede o tempo entre batimentos.\n\nValores maiores indicam boa capacidade de adaptação ao estresse.\nFaixa saudável: 20 – 100+ ms." },
  hb: { title: "Hemoglobina", desc: "Estimativa de hemoglobina no sangue.\n\nFaixa ideal: 12.0 – 17.5 g/dL." },
  hba1c: { title: "HbA1c (Hemoglobina Glicada)", desc: "Média de glicose nos últimos 2-3 meses.\n\nAbaixo de 5.7% é normal; 5.7 – 6.4% indica pré-diabetes; acima de 6.5%, diabetes." },
};

function getScoreColor(score: number) {
  if (score >= 70) return "var(--rpt-green)";
  if (score >= 40) return "var(--rpt-amber)";
  return "var(--rpt-red)";
}

function formatDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  return `${fmt(start)} – ${fmt(end)}`;
}

interface BarData {
  value: number;
  rawValue: number;
  label: string;
}

interface TrendState {
  hr: number[]; hrAvg: number | null; hrBars: BarData[];
  stress: number[]; stressAvg: number | null; stressBars: BarData[];
  spo2: number[]; spo2Avg: number | null; spo2Bars: BarData[];
  bpSys: number[]; bpDia: number[]; bpAvg: string | null; bpBars: BarData[];
  rr: number[]; rrAvg: number | null; rrBars: BarData[];
  hrv: number[]; hrvAvg: number | null; hrvBars: BarData[];
  hb: number[]; hbAvg: number | null; hbBars: BarData[];
  hba1c: number[]; hba1cAvg: number | null; hba1cBars: BarData[];
}

const emptyTrend: TrendState = {
  hr: [], hrAvg: null, hrBars: [],
  stress: [], stressAvg: null, stressBars: [],
  spo2: [], spo2Avg: null, spo2Bars: [],
  bpSys: [], bpDia: [], bpAvg: null, bpBars: [],
  rr: [], rrAvg: null, rrBars: [],
  hrv: [], hrvAvg: null, hrvBars: [],
  hb: [], hbAvg: null, hbBars: [],
  hba1c: [], hba1cAvg: null, hba1cBars: [],
};

interface TimelineGroupData {
  dayLabel: string;
  entries: { time: string; source: string; chips: { label: string; value: string; color: string; bg: string }[] }[];
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
}

function timeLabel(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function barLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(".", "");
}

function buildBarData(values: number[], pctValues: number[], dates: string[]): BarData[] {
  return values.map((raw, i) => ({
    value: pctValues[i],
    rawValue: raw,
    label: dates[i] ? barLabel(dates[i]) : `#${i + 1}`,
  }));
}

interface HealthReportProps {
  userIdOverride?: string;
  embedMode?: boolean;
  onBack?: () => void;
}

export default function HealthReport({ userIdOverride, embedMode, onBack }: HealthReportProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const targetUserId = userIdOverride || user?.id;
  const [profile, setProfile] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [trendData, setTrendData] = useState<TrendState>(emptyTrend);
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroupData[]>([]);
  const [companySurveys, setCompanySurveys] = useState<any[] | null>(null);
  const [infoSheet, setInfoSheet] = useState<{ open: boolean; key: string }>({ open: false, key: "score" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, birth_date, has_hypertension, has_diabetes, company_id")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => {
        setProfile(data);
        // Fetch company surveys/campaigns
        if (data?.company_id) {
          supabase.from("campaigns")
            .select("id, title, emoji, starts_at, ends_at, active, category")
            .eq("company_id", data.company_id)
            .eq("active", true)
            .order("starts_at", { ascending: false })
            .limit(5)
            .then(({ data: cData }) => setCompanySurveys(cData || []));
        } else {
          setCompanySurveys([]);
        }
      });
    supabase.from("health_scores").select("*").eq("user_id", user.id)
      .order("generated_at", { ascending: false }).limit(1).then(({ data }) => {
        if (data && data.length > 0) setScores(data[0]);
      });
    supabase.from("health_alerts").select("*").eq("user_id", user.id)
      .is("dismissed_at", null).order("generated_at", { ascending: false }).limit(5)
      .then(({ data }) => setAlerts(data || []));

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const measurementsPromise = supabase.from("health_measurements")
      .select("heart_rate, stress_level, spo2, blood_pressure_sys, blood_pressure_dia, respiratory_rate, hrv, measured_at, measurement_type, source")
      .eq("user_id", user.id)
      .gte("measured_at", weekAgo.toISOString())
      .order("measured_at", { ascending: true });

    const specialPromise = supabase.from("special_measurements" as any)
      .select("measurement_data, measured_at")
      .eq("user_id", user.id)
      .gte("measured_at", weekAgo.toISOString())
      .order("measured_at", { ascending: true });

    Promise.all([measurementsPromise, specialPromise]).then(([{ data: mData }, { data: sData }]) => {
      const m = (mData || []) as any[];
      const sp = (sData || []) as any[];

      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      const avgDec = (arr: number[]) => arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;

      const extract = (key: string) => {
        const vals: number[] = [];
        const dates: string[] = [];
        m.forEach(x => {
          const v = x[key];
          if (v != null) { vals.push(Number(v)); dates.push(x.measured_at); }
        });
        return { vals: vals.slice(-7), dates: dates.slice(-7) };
      };

      const hr = extract("heart_rate");
      const stress = extract("stress_level");
      const spo2 = extract("spo2");
      const bpSys = extract("blood_pressure_sys");
      const bpDia = extract("blood_pressure_dia");
      const rr = extract("respiratory_rate");
      const hrvE = extract("hrv");

      const hbVals: number[] = [], hbDates: string[] = [];
      const hba1cVals: number[] = [], hba1cDates: string[] = [];
      sp.forEach((s: any) => {
        const d = s.measurement_data;
        if (d?.hemoglobin != null) { hbVals.push(Number(d.hemoglobin)); hbDates.push(s.measured_at); }
        if (d?.hba1c != null) { hba1cVals.push(Number(d.hba1c)); hba1cDates.push(s.measured_at); }
      });

      const bpSysA = avg(bpSys.vals);
      const bpDiaA = avg(bpDia.vals);

      const hrPct = hr.vals.map(v => Math.round((v / 120) * 100));
      const stressPct = stress.vals;
      const spo2Pct = spo2.vals.map(v => Math.round(v));
      const bpSysPct = bpSys.vals.map(v => Math.round((v / 180) * 100));
      const rrPct = rr.vals.map(v => Math.round((v / 30) * 100));
      const hrvPct = hrvE.vals.map(v => Math.round((v / 100) * 100));
      const hbPct = hbVals.slice(-7).map(v => Math.round((v / 18) * 100));
      const hba1cPct = hba1cVals.slice(-7).map(v => Math.round((v / 10) * 100));

      setTrendData({
        hr: hrPct, hrAvg: avg(hr.vals),
        hrBars: buildBarData(hr.vals, hrPct, hr.dates),
        stress: stressPct, stressAvg: avg(stress.vals),
        stressBars: buildBarData(stress.vals, stressPct, stress.dates),
        spo2: spo2Pct, spo2Avg: avg(spo2.vals),
        spo2Bars: buildBarData(spo2.vals, spo2Pct, spo2.dates),
        bpSys: bpSysPct, bpDia: bpDia.vals,
        bpAvg: bpSysA != null && bpDiaA != null ? `${bpSysA}/${bpDiaA}` : null,
        bpBars: buildBarData(bpSys.vals, bpSysPct, bpSys.dates),
        rr: rrPct, rrAvg: avg(rr.vals),
        rrBars: buildBarData(rr.vals, rrPct, rr.dates),
        hrv: hrvPct, hrvAvg: avg(hrvE.vals),
        hrvBars: buildBarData(hrvE.vals, hrvPct, hrvE.dates),
        hb: hbPct, hbAvg: avgDec(hbVals.slice(-7)),
        hbBars: buildBarData(hbVals.slice(-7), hbPct, hbDates.slice(-7)),
        hba1c: hba1cPct, hba1cAvg: avgDec(hba1cVals.slice(-7)),
        hba1cBars: buildBarData(hba1cVals.slice(-7), hba1cPct, hba1cDates.slice(-7)),
      });

      // Build grouped timeline
      const groups = new Map<string, TimelineGroupData>();
      m.forEach((x: any) => {
        const dLabel = dayLabel(x.measured_at);
        const tLabel = timeLabel(x.measured_at);
        const src = x.source || x.measurement_type || "medição";
        const chips: { label: string; value: string; color: string; bg: string }[] = [];
        if (x.heart_rate) chips.push({ label: "FC", value: `${x.heart_rate} bpm`, color: "var(--rpt-red)", bg: "var(--rpt-red-bg)" });
        if (x.spo2 != null) chips.push({ label: "SpO2", value: `${x.spo2}%`, color: "var(--rpt-blue)", bg: "var(--rpt-blue-bg)" });
        if (x.blood_pressure_sys && x.blood_pressure_dia) chips.push({ label: "PA", value: `${x.blood_pressure_sys}/${x.blood_pressure_dia}`, color: "var(--rpt-purple)", bg: "var(--rpt-purple-bg)" });
        if (x.respiratory_rate) chips.push({ label: "Resp", value: `${x.respiratory_rate} rpm`, color: "var(--rpt-green)", bg: "var(--rpt-green-bg)" });
        if (x.hrv) chips.push({ label: "HRV", value: `${x.hrv} ms`, color: "var(--rpt-red)", bg: "var(--rpt-red-bg)" });
        if (x.stress_level != null) chips.push({ label: "Estresse", value: `${x.stress_level}%`, color: "var(--rpt-amber)", bg: "var(--rpt-amber-bg)" });

        if (!groups.has(dLabel)) {
          groups.set(dLabel, { dayLabel: dLabel, entries: [] });
        }
        groups.get(dLabel)!.entries.push({ time: tLabel, source: src, chips });
      });
      setTimelineGroups(Array.from(groups.values()));
    });
  }, [user]);

  const handleShare = async () => {
    if (!user || sharing) return;
    setSharing(true);
    try {
      const token = crypto.randomUUID();
      const expires = new Date();
      expires.setHours(expires.getHours() + 48);
      const { error } = await supabase.from("report_shares").insert({
        user_id: user.id,
        token,
        expires_at: expires.toISOString(),
      } as any);
      if (error) throw error;
      const url = `${window.location.origin}/relatorio/medico/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link foi copiado para a área de transferência. Válido por 48h." });
    } catch {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const openInfo = (key: string) => setInfoSheet({ open: true, key });

  const s = scores || { score_general: 75, score_physiological: 82, score_emotional: 58, score_lifestyle: 70, recommendation_level: 3 };
  const rec = RECOMMENDATION_TEXT[s.recommendation_level] || RECOMMENDATION_TEXT[2];
  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const age = profile?.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / 31557600000) : null;
  const conditions: string[] = [];
  if (profile?.has_hypertension) conditions.push("Hipertensão");
  if (profile?.has_diabetes) conditions.push("Diabetes");
  const metaText = [age ? `${age} anos` : null, ...conditions].filter(Boolean).join(" · ");
  const scoreHeading = s.score_general >= 70 ? "Dentro do esperado" : s.score_general >= 40 ? "Atenção moderada" : "Situação crítica";

  const displayAlerts = alerts.length > 0 ? alerts.map((a: any) => ({
    text: a.description,
    subtext: a.detail || `${a.days_triggered || 0} dias detectados`,
    severity: a.severity === "critical" ? "critical" as const : a.severity === "high" ? "warning" as const : a.severity === "medium" ? "info" as const : "low" as const,
  })) : [
    { text: "Sem alertas no período", subtext: "Nenhum desvio significativo detectado nos últimos 7 dias", severity: "low" as const },
  ];

  const currentInfo = INFO_TEXTS[infoSheet.key] || INFO_TEXTS.score;

  return (
    <div className="report-shell">
      {/* INFO SHEET */}
      <InfoSheet
        open={infoSheet.open}
        onOpenChange={(open) => setInfoSheet({ ...infoSheet, open })}
        title={currentInfo.title}
        description={currentInfo.desc}
        details={currentInfo.details}
      />

      {/* TOPBAR */}
      <div className="rpt-topbar">
        <div className="rpt-topbar-meta">
          <span className="rpt-topbar-title">Relatório de saúde</span>
          <span className="rpt-week-chip">{formatDateRange()}</span>
        </div>
        <div className="rpt-patient-row">
          <div className="rpt-avatar">{initials}</div>
          <div className="rpt-patient-info">
            <div className="rpt-patient-name">{profile?.full_name || "Carregando..."}</div>
            <div className="rpt-patient-meta">{metaText || "Sem dados clínicos"}</div>
          </div>
          <button className="rpt-share-btn" onClick={handleShare} disabled={sharing}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 2L14 6L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13C2 10.2 4.2 8 7 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Compartilhar
          </button>
        </div>
      </div>

      {/* EMPTY DATA BANNER */}
      {!scores && (
        <div className="rpt-empty-banner">
          <div className="rpt-empty-icon">ℹ️</div>
          <div className="rpt-empty-content">
            <p className="rpt-empty-text">
              Você ainda não possui dados de medição. Use a funcionalidade de medição por câmera ou conecte um relógio de saúde para gerar seu relatório completo.
            </p>
            <button className="rpt-empty-btn" onClick={() => navigate("/")}>
              📷 Fazer minha primeira medição
            </button>
          </div>
        </div>
      )}

      {/* SCORE */}
      <div className="rpt-section" style={{ marginTop: 16 }}>
        <div className="rpt-section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Score geral
          <InfoButton onClick={() => openInfo("score")} />
        </div>
        <div className="rpt-score-card">
          <ScoreRing score={scores ? s.score_general : 0} color={scores ? getScoreColor(s.score_general) : "var(--rpt-text-tertiary)"} />
          <div className="rpt-score-info">
            <div className="rpt-score-heading">{scores ? scoreHeading : "Sem dados"}</div>
            <div className="rpt-score-subtext">{scores ? "Pontos de melhora identificados" : "Realize uma medição para gerar seu score"}</div>
            <div className="rpt-subscores">
              {[
                { name: "Fisiológico", val: scores ? s.score_physiological : 0 },
                { name: "Emocional", val: scores ? s.score_emotional : 0 },
                { name: "Estilo de vida", val: scores ? s.score_lifestyle : 0 },
              ].map((sub) => (
                <div key={sub.name} className="rpt-subscore-row">
                  <span className="rpt-subscore-name">{sub.name}</span>
                  <div className="rpt-subscore-track">
                    <div className="rpt-subscore-fill" style={{ width: `${sub.val}%`, background: scores ? getScoreColor(sub.val) : "var(--rpt-text-tertiary)" }} />
                  </div>
                  <span className="rpt-subscore-val" style={{ color: scores ? getScoreColor(sub.val) : "var(--rpt-text-tertiary)" }}>{scores ? sub.val : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Alertas da semana</div>
        <div className="rpt-alerts">
          {displayAlerts.map((a, i) => (
            <AlertCard key={i} text={a.text} subtext={a.subtext} severity={a.severity} />
          ))}
        </div>
      </div>

      {/* TRENDS — 8 cards in 2x4 grid */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Tendências — 7 dias</div>
        <div className="rpt-trend-grid">
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 3C10 3 6 7.5 6 11.5A4 4 0 0014 11.5C14 7.5 10 3 10 3Z" fill="var(--rpt-red)" opacity="0.8"/></svg>}
            iconBg="var(--rpt-red-bg)" arrow="↑" arrowColor="var(--rpt-red)"
            value={trendData.hrAvg != null ? String(trendData.hrAvg) : "--"} unit="bpm" name="Freq. cardíaca"
            bars={trendData.hr} barColor="var(--rpt-red)"
            barData={trendData.hrBars} idealRange="60-100 bpm" onInfoClick={() => openInfo("hr")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="4" fill="var(--rpt-amber)" opacity="0.8"/><path d="M10 14V18M7 17L10 18L13 17" stroke="var(--rpt-amber)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
            iconBg="var(--rpt-amber-bg)" arrow="↑" arrowColor="var(--rpt-amber)"
            value={trendData.stressAvg != null ? String(trendData.stressAvg) : "--"} unit="/100" name="Estresse"
            bars={trendData.stress} barColor="var(--rpt-amber)"
            barData={trendData.stressBars} idealRange="< 40" onInfoClick={() => openInfo("stress")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6" fill="var(--rpt-blue)" opacity="0.15"/><text x="10" y="13" textAnchor="middle" fontSize="9" fill="var(--rpt-blue)" fontWeight="bold">O₂</text></svg>}
            iconBg="var(--rpt-blue-bg)" arrow="→" arrowColor="var(--rpt-blue)"
            value={trendData.spo2Avg != null ? String(trendData.spo2Avg) : "--"} unit="%" name="SpO2"
            bars={trendData.spo2} barColor="var(--rpt-blue)"
            barData={trendData.spo2Bars} idealRange="95-100%" onInfoClick={() => openInfo("spo2")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 14L8 6L12 12L16 4" stroke="var(--rpt-purple)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--rpt-purple-bg)" arrow="→" arrowColor="var(--rpt-purple)"
            value={trendData.bpAvg || "--"} unit="mmHg" name="Pressão arterial"
            bars={trendData.bpSys} barColor="var(--rpt-purple)"
            barData={trendData.bpBars} idealRange="90/60 – 120/80" onInfoClick={() => openInfo("bp")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 10C5 6 8 4 10 4S15 6 17 10C15 14 12 16 10 16S5 14 3 10Z" fill="var(--rpt-green)" opacity="0.2" stroke="var(--rpt-green)" strokeWidth="1.2"/></svg>}
            iconBg="var(--rpt-green-bg)" arrow="→" arrowColor="var(--rpt-green)"
            value={trendData.rrAvg != null ? String(trendData.rrAvg) : "--"} unit="rpm" name="Respiração"
            bars={trendData.rr} barColor="var(--rpt-green)"
            barData={trendData.rrBars} idealRange="12-20 rpm" onInfoClick={() => openInfo("rr")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 10H6L8 4L10 16L12 8L14 10H18" stroke="var(--rpt-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--rpt-red-bg)" arrow="→" arrowColor="var(--rpt-red)"
            value={trendData.hrvAvg != null ? String(trendData.hrvAvg) : "--"} unit="ms" name="HRV (SDNN)"
            bars={trendData.hrv} barColor="var(--rpt-red)"
            barData={trendData.hrvBars} idealRange="20-100+ ms" onInfoClick={() => openInfo("hrv")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2C7 6 5 9 5 12a5 5 0 0010 0c0-3-2-6-5-10Z" fill="var(--rpt-amber)" opacity="0.7"/></svg>}
            iconBg="var(--rpt-amber-bg)" arrow="→" arrowColor="var(--rpt-amber)"
            value={trendData.hbAvg != null ? String(trendData.hbAvg) : "--"} unit="g/dL" name="Hemoglobina"
            bars={trendData.hb} barColor="var(--rpt-amber)"
            barData={trendData.hbBars} idealRange="12.0-17.5 g/dL" onInfoClick={() => openInfo("hb")}
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6" fill="var(--rpt-purple)" opacity="0.15"/><text x="10" y="13" textAnchor="middle" fontSize="8" fill="var(--rpt-purple)" fontWeight="bold">A1c</text></svg>}
            iconBg="var(--rpt-purple-bg)" arrow="→" arrowColor="var(--rpt-purple)"
            value={trendData.hba1cAvg != null ? String(trendData.hba1cAvg) : "--"} unit="%" name="HbA1c"
            bars={trendData.hba1c} barColor="var(--rpt-purple)"
            barData={trendData.hba1cBars} idealRange="< 5.7%" onInfoClick={() => openInfo("hba1c")}
          />
        </div>
      </div>

      {/* QUESTIONNAIRES */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Questionários</div>
        <div className="rpt-q-list">
          {companySurveys === null ? (
            <div className="rpt-q-card">
              <div className="rpt-q-text" style={{ textAlign: "center", padding: 8 }}>Carregando...</div>
            </div>
          ) : companySurveys.length === 0 ? (
            <div className="rpt-q-card">
              <div className="rpt-q-header">
                <span className="rpt-q-category">Campanhas</span>
                <span className="rpt-q-status" style={{ background: "var(--rpt-surface2)", color: "var(--rpt-text-tertiary)" }}>Sem dados</span>
              </div>
              <div className="rpt-q-text">Nenhuma campanha de questionários ativa para sua empresa no momento.</div>
            </div>
          ) : companySurveys.map((c) => (
            <div key={c.id} className="rpt-q-card">
              <div className="rpt-q-header">
                <span className="rpt-q-category">{c.emoji || "📋"} {c.title}</span>
                <span className="rpt-q-status" style={{
                  background: new Date(c.ends_at) > new Date() ? "var(--rpt-green-bg)" : "var(--rpt-surface2)",
                  color: new Date(c.ends_at) > new Date() ? "var(--rpt-green)" : "var(--rpt-text-tertiary)",
                }}>
                  {new Date(c.ends_at) > new Date() ? "Ativa" : "Encerrada"}
                </span>
              </div>
              <div className="rpt-q-text">
                {c.category || "Campanha corporativa"} · até {new Date(c.ends_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Linha do tempo semanal</div>
        {timelineGroups.length > 0 ? (
          <div className="rpt-timeline">
            {timelineGroups.map((g, i) => (
              <TimelineGroup key={i} dayLabel={g.dayLabel} entries={g.entries} />
            ))}
          </div>
        ) : (
          <div className="rpt-timeline">
            <TimelineItem
              day="Sem eventos registrados" event="Nenhuma medição ou questionário foi registrado nos últimos 7 dias."
              tag="Sem dado no período" tagColor="var(--rpt-text-tertiary)" tagBg="var(--rpt-surface2)"
              dotColor="var(--rpt-text-tertiary)" showLine={false}
            />
          </div>
        )}
      </div>

      {/* RECOMMENDATION */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Recomendação</div>
        <div className="rpt-rec-card">
          <div className="rpt-rec-orb" style={{ width: 180, height: 180, top: -60, right: -50 }} />
          <div className="rpt-rec-orb" style={{ width: 120, height: 120, bottom: -40, left: -30 }} />
          <div className="rpt-rec-eyebrow">Com base nos dados da semana</div>
          <div className="rpt-rec-title">{rec.title}</div>
          <div className="rpt-rec-body">{rec.body}</div>
          <button className="rpt-rec-btn" onClick={handleShare}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 2L14 6L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13C2 10.2 4.2 8 7 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Compartilhar com médico (48h)
          </button>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--rpt-text-secondary)" }}>
              ou gerencie o acesso permanente em{" "}
              <span style={{ color: "var(--rpt-blue)", cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate("/")}>
                Perfil → Meus Médicos
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="rpt-nav-spacer" />

      <ReportBottomNav activeTab="relatorio" onNavigate={(tab) => {
        if (tab === "inicio") navigate("/");
        else if (tab === "perfil") navigate("/");
      }} />
    </div>
  );
}
