import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

interface TrendState {
  hr: number[]; hrAvg: number | null;
  stress: number[]; stressAvg: number | null;
  spo2: number[]; spo2Avg: number | null;
  bpSys: number[]; bpDia: number[]; bpAvg: string | null;
  rr: number[]; rrAvg: number | null;
  hrv: number[]; hrvAvg: number | null;
  hb: number[]; hbAvg: number | null;
  hba1c: number[]; hba1cAvg: number | null;
}

const emptyTrend: TrendState = {
  hr: [], hrAvg: null,
  stress: [], stressAvg: null,
  spo2: [], spo2Avg: null,
  bpSys: [], bpDia: [], bpAvg: null,
  rr: [], rrAvg: null,
  hrv: [], hrvAvg: null,
  hb: [], hbAvg: null,
  hba1c: [], hba1cAvg: null,
};

export default function HealthReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [trendData, setTrendData] = useState<TrendState>(emptyTrend);
  const [timeline, setTimeline] = useState<{ day: string; event: string; tag: string; tagColor: string; tagBg: string; dotColor: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, birth_date, has_hypertension, has_diabetes")
      .eq("user_id", user.id).maybeSingle().then(({ data }) => setProfile(data));
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

    // Fetch health_measurements
    const measurementsPromise = supabase.from("health_measurements")
      .select("heart_rate, stress_level, spo2, blood_pressure_sys, blood_pressure_dia, respiratory_rate, hrv, measured_at, measurement_type, source")
      .eq("user_id", user.id)
      .gte("measured_at", weekAgo.toISOString())
      .order("measured_at", { ascending: true });

    // Fetch special_measurements for hemoglobin & hba1c
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

      const hrVals = m.map(x => x.heart_rate).filter((v): v is number => v != null);
      const stressVals = m.map(x => x.stress_level).filter((v): v is number => v != null);
      const spo2Vals = m.map(x => x.spo2 != null ? Number(x.spo2) : null).filter((v): v is number => v != null);
      const bpSysVals = m.map(x => x.blood_pressure_sys).filter((v): v is number => v != null);
      const bpDiaVals = m.map(x => x.blood_pressure_dia).filter((v): v is number => v != null);
      const rrVals = m.map(x => x.respiratory_rate).filter((v): v is number => v != null);
      const hrvVals = m.map(x => x.hrv).filter((v): v is number => v != null);

      // Extract hemoglobin & hba1c from special_measurements
      const hbVals: number[] = [];
      const hba1cVals: number[] = [];
      sp.forEach((s: any) => {
        const d = s.measurement_data;
        if (d?.hemoglobin != null) hbVals.push(Number(d.hemoglobin));
        if (d?.hba1c != null) hba1cVals.push(Number(d.hba1c));
      });

      const bpSysA = avg(bpSysVals);
      const bpDiaA = avg(bpDiaVals);

      setTrendData({
        hr: hrVals.slice(-7).map(v => Math.round((v / 120) * 100)),
        hrAvg: avg(hrVals),
        stress: stressVals.slice(-7),
        stressAvg: avg(stressVals),
        spo2: spo2Vals.slice(-7).map(v => Math.round(v)),
        spo2Avg: avg(spo2Vals),
        bpSys: bpSysVals.slice(-7).map(v => Math.round((v / 180) * 100)),
        bpDia: bpDiaVals.slice(-7),
        bpAvg: bpSysA != null && bpDiaA != null ? `${bpSysA}/${bpDiaA}` : null,
        rr: rrVals.slice(-7).map(v => Math.round((v / 30) * 100)),
        rrAvg: avg(rrVals),
        hrv: hrvVals.slice(-7).map(v => Math.round((v / 100) * 100)),
        hrvAvg: avg(hrvVals),
        hb: hbVals.slice(-7).map(v => Math.round((v / 18) * 100)),
        hbAvg: avgDec(hbVals),
        hba1c: hba1cVals.slice(-7).map(v => Math.round((v / 10) * 100)),
        hba1cAvg: avgDec(hba1cVals),
      });

      // Build timeline from health_measurements
      const tl = m.map((x: any) => {
        const d = new Date(x.measured_at);
        const dayStr = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
        const parts: string[] = [];
        if (x.heart_rate) parts.push(`FC ${x.heart_rate} bpm`);
        if (x.spo2 != null) parts.push(`SpO2 ${x.spo2}%`);
        if (x.blood_pressure_sys && x.blood_pressure_dia) parts.push(`PA ${x.blood_pressure_sys}/${x.blood_pressure_dia}`);
        if (x.respiratory_rate) parts.push(`Resp ${x.respiratory_rate} rpm`);
        if (x.hrv) parts.push(`HRV ${x.hrv} ms`);
        if (x.stress_level != null) parts.push(`Estresse ${x.stress_level}%`);
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

      {/* TRENDS — 8 cards in 2x4 grid */}
      <div className="rpt-section" style={{ marginTop: 20 }}>
        <div className="rpt-section-label">Tendências — 7 dias</div>
        <div className="rpt-trend-grid">
          {/* 1. Freq. Cardíaca */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 3C10 3 6 7.5 6 11.5A4 4 0 0014 11.5C14 7.5 10 3 10 3Z" fill="var(--rpt-red)" opacity="0.8"/></svg>}
            iconBg="var(--rpt-red-bg)" arrow="↑" arrowColor="var(--rpt-red)"
            value={trendData.hrAvg != null ? String(trendData.hrAvg) : "--"} unit="bpm" name="Freq. cardíaca"
            bars={trendData.hr.length > 0 ? trendData.hr : []} barColor="var(--rpt-red)"
          />
          {/* 2. Estresse */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="4" fill="var(--rpt-amber)" opacity="0.8"/><path d="M10 14V18M7 17L10 18L13 17" stroke="var(--rpt-amber)" strokeWidth="1.4" strokeLinecap="round"/></svg>}
            iconBg="var(--rpt-amber-bg)" arrow="↑" arrowColor="var(--rpt-amber)"
            value={trendData.stressAvg != null ? String(trendData.stressAvg) : "--"} unit="/100" name="Estresse"
            bars={trendData.stress.length > 0 ? trendData.stress : []} barColor="var(--rpt-amber)"
          />
          {/* 3. SpO2 */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6" fill="var(--rpt-blue)" opacity="0.15"/><text x="10" y="13" textAnchor="middle" fontSize="9" fill="var(--rpt-blue)" fontWeight="bold">O₂</text></svg>}
            iconBg="var(--rpt-blue-bg)" arrow="→" arrowColor="var(--rpt-blue)"
            value={trendData.spo2Avg != null ? String(trendData.spo2Avg) : "--"} unit="%" name="SpO2"
            bars={trendData.spo2.length > 0 ? trendData.spo2 : []} barColor="var(--rpt-blue)"
          />
          {/* 4. Pressão Arterial */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 14L8 6L12 12L16 4" stroke="var(--rpt-purple)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--rpt-purple-bg)" arrow="→" arrowColor="var(--rpt-purple)"
            value={trendData.bpAvg || "--"} unit="mmHg" name="Pressão arterial"
            bars={trendData.bpSys.length > 0 ? trendData.bpSys : []} barColor="var(--rpt-purple)"
          />
          {/* 5. Respiração */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 10C5 6 8 4 10 4S15 6 17 10C15 14 12 16 10 16S5 14 3 10Z" fill="var(--rpt-green)" opacity="0.2" stroke="var(--rpt-green)" strokeWidth="1.2"/></svg>}
            iconBg="var(--rpt-green-bg)" arrow="→" arrowColor="var(--rpt-green)"
            value={trendData.rrAvg != null ? String(trendData.rrAvg) : "--"} unit="rpm" name="Respiração"
            bars={trendData.rr.length > 0 ? trendData.rr : []} barColor="var(--rpt-green)"
          />
          {/* 6. HRV SDNN */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M2 10H6L8 4L10 16L12 8L14 10H18" stroke="var(--rpt-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--rpt-red-bg)" arrow="→" arrowColor="var(--rpt-red)"
            value={trendData.hrvAvg != null ? String(trendData.hrvAvg) : "--"} unit="ms" name="HRV (SDNN)"
            bars={trendData.hrv.length > 0 ? trendData.hrv : []} barColor="var(--rpt-red)"
          />
          {/* 7. Hemoglobina */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2C7 6 5 9 5 12a5 5 0 0010 0c0-3-2-6-5-10Z" fill="var(--rpt-amber)" opacity="0.7"/></svg>}
            iconBg="var(--rpt-amber-bg)" arrow="→" arrowColor="var(--rpt-amber)"
            value={trendData.hbAvg != null ? String(trendData.hbAvg) : "--"} unit="g/dL" name="Hemoglobina"
            bars={trendData.hb.length > 0 ? trendData.hb : []} barColor="var(--rpt-amber)"
          />
          {/* 8. HbA1c */}
          <TrendCard
            icon={<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6" fill="var(--rpt-purple)" opacity="0.15"/><text x="10" y="13" textAnchor="middle" fontSize="8" fill="var(--rpt-purple)" fontWeight="bold">A1c</text></svg>}
            iconBg="var(--rpt-purple-bg)" arrow="→" arrowColor="var(--rpt-purple)"
            value={trendData.hba1cAvg != null ? String(trendData.hba1cAvg) : "--"} unit="%" name="HbA1c"
            bars={trendData.hba1c.length > 0 ? trendData.hba1c : []} barColor="var(--rpt-purple)"
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
          {timeline.length > 0 ? timeline.map((t, i) => (
            <TimelineItem
              key={i}
              day={t.day} event={t.event}
              tag={t.tag} tagColor={t.tagColor} tagBg={t.tagBg}
              dotColor={t.dotColor} showLine={i < timeline.length - 1}
            />
          )) : (
            <TimelineItem
              day="Sem eventos registrados" event="Nenhuma medição ou questionário foi registrado nos últimos 7 dias."
              tag="Sem dado no período" tagColor="var(--rpt-text-tertiary)" tagBg="var(--rpt-surface2)"
              dotColor="var(--rpt-text-tertiary)" showLine={false}
            />
          )}
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
