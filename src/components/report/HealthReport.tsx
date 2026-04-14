import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScoreRing } from "./ScoreRing";
import { AlertCard } from "./AlertCard";
import { TrendCard } from "./TrendCard";
import { TimelineItem } from "./TimelineItem";
import { ReportBottomNav } from "./ReportBottomNav";
import { toast } from "@/hooks/use-toast";
import "./report.css";

const RECOMMENDATION_TEXT: Record<number, { title: string; body: string }> = {
  1: { title: "Tudo dentro do esperado", body: "Seus indicadores estão estáveis e dentro dos padrões habituais. Continue assim!" },
  2: { title: "Vale acompanhar de perto", body: "Alguns indicadores mostraram variações leves na semana. Nada alarmante, mas vale prestar atenção nas próximas medições." },
  3: { title: "Recomendamos uma consulta", body: "Há sinais persistentes que justificam avaliação profissional. Considere agendar uma consulta para revisão." },
  4: { title: "Procure atendimento em breve", body: "Combinação de indicadores fora do padrão sugere necessidade de avaliação clínica em breve." },
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

export default function HealthReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [trendData, setTrendData] = useState<{ hr: number[]; stress: number[]; sleep: number[]; steps: number[]; hrAvg: number | null; stressAvg: number | null; sleepAvg: string | null; stepsAvg: number | null }>({
    hr: [], stress: [], sleep: [], steps: [], hrAvg: null, stressAvg: null, sleepAvg: null, stepsAvg: null,
  });
  const [timeline, setTimeline] = useState<{ day: string; event: string; tag: string; tagColor: string; tagBg: string; dotColor: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    // Fetch profile
    supabase.from("profiles").select("full_name, birth_date, has_hypertension, has_diabetes")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => setProfile(data));
    // Fetch latest scores
    supabase.from("health_scores").select("*").eq("user_id", user.id)
      .order("generated_at", { ascending: false }).limit(1).then(({ data }) => {
        if (data && data.length > 0) setScores(data[0]);
      });
    // Fetch alerts
    supabase.from("health_alerts").select("*").eq("user_id", user.id)
      .is("dismissed_at", null).order("generated_at", { ascending: false }).limit(5)
      .then(({ data }) => setAlerts(data || []));

    // Fetch 7-day measurements for trends & timeline
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    supabase.from("health_measurements").select("heart_rate, stress_level, sleep_duration_min, steps, measured_at, measurement_type, source")
      .eq("user_id", user.id)
      .gte("measured_at", weekAgo.toISOString())
      .order("measured_at", { ascending: true })
      .then(({ data }) => {
        const m = data || [];
        const hrVals = m.map((x: any) => x.heart_rate).filter((v: any) => v != null);
        const stressVals = m.map((x: any) => x.stress_level).filter((v: any) => v != null);
        const sleepVals = m.map((x: any) => x.sleep_duration_min).filter((v: any) => v != null);
        const stepsVals = m.map((x: any) => x.steps).filter((v: any) => v != null);

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
        const sleepA = avg(sleepVals);

        setTrendData({
          hr: hrVals.slice(-7).map((v: number) => Math.round((v / 120) * 100)),
          stress: stressVals.slice(-7),
          sleep: sleepVals.slice(-7).map((v: number) => Math.round((v / 600) * 100)),
          steps: stepsVals.slice(-7).map((v: number) => Math.round((v / 12000) * 100)),
          hrAvg: avg(hrVals),
          stressAvg: avg(stressVals),
          sleepAvg: sleepA != null ? `${Math.floor(sleepA / 60)}h${String(sleepA % 60).padStart(2, "0")}` : null,
          stepsAvg: avg(stepsVals),
        });

        // Build timeline
        const tl = m.map((x: any) => {
          const d = new Date(x.measured_at);
          const dayStr = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
          const parts: string[] = [];
          if (x.heart_rate) parts.push(`FC ${x.heart_rate} bpm`);
          if (x.stress_level != null) parts.push(`Estresse ${x.stress_level}%`);
          if (x.sleep_duration_min) parts.push(`Sono ${Math.floor(x.sleep_duration_min / 60)}h`);
          const src = x.source || x.measurement_type || "medição";
          return {
            day: dayStr,
            event: parts.join(" · ") || "Medição registrada",
            tag: src,
            tagColor: "var(--rpt-blue)",
            tagBg: "var(--rpt-blue-bg)",
            dotColor: "var(--rpt-blue)",
          };
        });
        setTimeline(tl);
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

  // Use real scores or defaults
  const s = scores || { score_general: 75, score_physiological: 82, score_emotional: 58, score_lifestyle: 70, recommendation_level: 3 };
  const rec = RECOMMENDATION_TEXT[s.recommendation_level] || RECOMMENDATION_TEXT[2];
  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const age = profile?.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / 31557600000) : null;
  const conditions: string[] = [];
  if (profile?.has_hypertension) conditions.push("Hipertensão");
  if (profile?.has_diabetes) conditions.push("Diabetes");
  const metaText = [age ? `${age} anos` : null, ...conditions].filter(Boolean).join(" · ");

  const scoreHeading = s.score_general >= 70 ? "Dentro do esperado" : s.score_general >= 40 ? "Atenção moderada" : "Situação crítica";

  // Demo alerts if none
  const displayAlerts = alerts.length > 0 ? alerts.map((a: any) => ({
    text: a.description,
    subtext: a.detail || `${a.days_triggered || 0} dias detectados`,
    severity: a.severity === "critical" ? "critical" as const : a.severity === "high" ? "warning" as const : a.severity === "medium" ? "info" as const : "low" as const,
  })) : [
    { text: "Sem alertas no período", subtext: "Nenhum desvio significativo detectado nos últimos 7 dias", severity: "low" as const },
  ];

  return (
    <div className="report-shell">
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
        <div className="rpt-section-label">Score geral</div>
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

      {/* TRENDS */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Tendências — 7 dias</div>
        <div className="rpt-trend-grid">
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 3C10 3 6 7.5 6 11.5A4 4 0 0014 11.5C14 7.5 10 3 10 3Z" fill="var(--rpt-red)" opacity="0.8"/></svg>}
            iconBg="var(--rpt-red-bg)" arrow={trendData.hrAvg ? "↑" : ""} arrowColor="var(--rpt-red)"
            value={trendData.hrAvg != null ? String(trendData.hrAvg) : "--"} unit="bpm" name="Freq. cardíaca"
            bars={trendData.hr.length > 0 ? trendData.hr : [40,55,50,65,70,85,100]} barColor="var(--rpt-red)"
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="4" fill="var(--rpt-amber)" opacity="0.8"/><path d="M10 14V18M7 17L10 18L13 17" stroke="var(--rpt-amber)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
            iconBg="var(--rpt-amber-bg)" arrow={trendData.stressAvg ? "↑" : ""} arrowColor="var(--rpt-amber)"
            value={trendData.stressAvg != null ? String(trendData.stressAvg) : "--"} unit="/100" name="Estresse"
            bars={trendData.stress.length > 0 ? trendData.stress : [30,55,60,70,78,88,100]} barColor="var(--rpt-amber)"
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2C7 6 5 9 5 12a5 5 0 0010 0c0-3-2-6-5-10Z" fill="var(--rpt-purple)" opacity="0.7"/></svg>}
            iconBg="var(--rpt-purple-bg)" arrow={trendData.sleepAvg ? "↓" : ""} arrowColor="var(--rpt-purple)"
            value={trendData.sleepAvg || "--"} name="Sono médio"
            bars={trendData.sleep.length > 0 ? trendData.sleep : [90,80,70,60,55,48,38]} barColor="var(--rpt-purple)"
          />
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="3" fill="none" stroke="var(--rpt-blue)" strokeWidth="1.5"/><path d="M10 11v7M7 15l3 3 3-3" stroke="var(--rpt-blue)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--rpt-blue-bg)" arrow={trendData.stepsAvg ? "→" : ""} arrowColor="var(--rpt-blue)"
            value={trendData.stepsAvg != null ? String(trendData.stepsAvg) : "--"} name="Passos/dia"
            bars={trendData.steps.length > 0 ? trendData.steps : [55,80,45,70,65,60,58]} barColor="var(--rpt-blue)"
          />
        </div>
      </div>

      {/* QUESTIONNAIRES */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Questionários</div>
        <div className="rpt-q-list">
          {[
            { cat: "Saúde mental e emocional", status: "Sem dados", statusBg: "var(--rpt-surface2)", statusColor: "var(--rpt-text-tertiary)", text: "Sem respostas registradas no período.", varDot: "var(--rpt-text-tertiary)", varText: "Nenhum registro" },
            { cat: "Sono e recuperação", status: "Sem dados", statusBg: "var(--rpt-surface2)", statusColor: "var(--rpt-text-tertiary)", text: "Sem respostas registradas no período.", varDot: "var(--rpt-text-tertiary)", varText: "Nenhum registro" },
            { cat: "Disposição e energia", status: "Sem dados", statusBg: "var(--rpt-surface2)", statusColor: "var(--rpt-text-tertiary)", text: "Sem respostas registradas no período.", varDot: "var(--rpt-text-tertiary)", varText: "Nenhum registro" },
          ].map((q, i) => (
            <div key={i} className="rpt-q-card">
              <div className="rpt-q-header">
                <span className="rpt-q-category">{q.cat}</span>
                <span className="rpt-q-status" style={{ background: q.statusBg, color: q.statusColor }}>{q.status}</span>
              </div>
              <div className="rpt-q-text">{q.text}</div>
              <div className="rpt-q-variation">
                <div className="rpt-q-var-dot" style={{ background: q.varDot }} />
                <span className="rpt-q-var-text">{q.varText}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TIMELINE */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Linha do tempo semanal</div>
        <div className="rpt-timeline">
          <TimelineItem
            day="Sem eventos registrados" event="Nenhuma medição ou questionário foi registrado nos últimos 7 dias."
            tag="Sem dado no período" tagColor="var(--rpt-text-tertiary)" tagBg="var(--rpt-surface2)"
            dotColor="var(--rpt-text-tertiary)" showLine={false}
          />
        </div>
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
