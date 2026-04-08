import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScoreRing } from "./ScoreRing";
import { AlertCard } from "./AlertCard";
import { TimelineItem } from "./TimelineItem";
import { toast } from "@/hooks/use-toast";
import "./report.css";

function getScoreColor(score: number) {
  if (score >= 70) return "#4CAF82";
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

type TabId = "resumo" | "sinais" | "historico" | "nota";

export default function ProfessionalReport() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("resumo");
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [share, setShare] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      // Try report_shares first (temporary 48h links)
      const { data: shareData } = await supabase.from("report_shares").select("*").eq("token", token).maybeSingle();
      
      let userId: string | null = null;

      if (shareData && new Date(shareData.expires_at) >= new Date()) {
        setShare(shareData);
        userId = shareData.user_id;
        if (!shareData.accessed_at) {
          await supabase.from("report_shares").update({ accessed_at: new Date().toISOString() } as any).eq("id", shareData.id);
        }
      } else {
        // Try prontuario_connections (permanent tokens)
        const { data: connData } = await supabase.from("prontuario_connections" as any)
          .select("*")
          .eq("report_token", token)
          .eq("active", true)
          .maybeSingle();

        if (connData && typeof connData === "object" && "user_id" in connData) {
          setShare({ permanent: true, user_id: (connData as any).user_id });
          userId = (connData as any).user_id;
        }
      }

      if (!userId) {
        setExpired(true);
        setLoading(false);
        return;
      }

      // Fetch patient data
      const { data: prof } = await supabase.from("profiles")
        .select("full_name, birth_date, has_hypertension, has_diabetes, biological_sex")
        .eq("user_id", userId).maybeSingle();
      setProfile(prof);

      const { data: sc } = await supabase.from("health_scores").select("*")
        .eq("user_id", userId).order("generated_at", { ascending: false }).limit(1);
      if (sc && sc.length > 0) setScores(sc[0]);

      const { data: al } = await supabase.from("health_alerts").select("*")
        .eq("user_id", userId).is("dismissed_at", null)
        .order("generated_at", { ascending: false }).limit(5);
      setAlerts(al || []);

      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="report-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--rpt-doctor-accent)", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="report-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>Link expirado ou inválido</h2>
        <p style={{ fontSize: 13, color: "var(--rpt-text-secondary)", textAlign: "center" }}>Este link de acesso ao relatório não é mais válido. Solicite um novo link ao paciente.</p>
      </div>
    );
  }

  const s = scores || { score_general: 75, score_physiological: 82, score_emotional: 58, score_lifestyle: 70, recommendation_level: 3 };
  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const age = profile?.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / 31557600000) : null;
  const sex = profile?.biological_sex === "male" ? "Masc" : profile?.biological_sex === "female" ? "Fem" : null;
  const conditions: string[] = [];
  if (profile?.has_hypertension) conditions.push("H. Primária I10");
  if (profile?.has_diabetes) conditions.push("Diabético tipo 2");
  const metaParts = [age ? `${age} anos` : null, sex, ...conditions].filter(Boolean);

  const scoreHeading = s.score_general >= 70 ? "Dentro do esperado" : s.score_general >= 40 ? "Atenção moderada" : "Situação crítica";
  const scoreSubtext = s.score_general >= 70 ? "Indicadores estáveis" : "Estresse e sono críticos";

  const displayAlerts = alerts.length > 0 ? alerts.map((a: any) => ({
    text: a.description,
    subtext: a.detail || `${a.days_triggered || 0} dias detectados`,
    severity: a.severity === "critical" ? "critical" as const : a.severity === "high" ? "warning" as const : a.severity === "medium" ? "info" as const : "low" as const,
  })) : [
    { text: "Sem alertas clínicos no período", subtext: "Nenhum desvio significativo nos últimos 7 dias", severity: "low" as const },
  ];

  const handleSaveNote = async () => {
    if (!share || saving) return;
    setSaving(true);
    try {
      await supabase.from("clinical_notes").insert({
        user_id: share.user_id,
        note_text: noteText,
      } as any);
      toast({ title: "Nota salva com sucesso" });
    } catch {
      toast({ title: "Erro ao salvar nota", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    navigate("/");
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: "resumo", label: "Resumo" },
    { id: "sinais", label: "Sinais" },
    { id: "historico", label: "Histórico" },
    { id: "nota", label: "Nota clínica" },
  ];

  const signalRows = [
    { metric: "Freq. cardíaca média", source: "Smartwatch · prioridade", current: "-- bpm", baseline: "sem baseline", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "HRV médio", source: "rPPG câmera + smartwatch", current: "-- ms", baseline: "sem baseline", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Pressão arterial est.", source: "rPPG câmera · estimada", current: "--/--", baseline: "meta: < 130/80", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "SpO₂", source: "rPPG câmera", current: "--%", baseline: "referência: ≥ 95%", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Glicemia estimada", source: "rPPG câmera · estimada", current: "-- mg/dL", baseline: "meta: < 100 mg/dL", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Freq. respiratória", source: "rPPG câmera", current: "-- irpm", baseline: "referência: 12–20", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Estresse (rPPG)", source: "rPPG câmera", current: "--/100", baseline: "sem baseline", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Sono médio", source: "Smartwatch · prioridade", current: "--", baseline: "sem baseline", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
    { metric: "Passos por dia", source: "Smartwatch · prioridade", current: "--", baseline: "meta: 8.000", dir: "→", dirColor: "var(--rpt-text-tertiary)", badge: "Sem dado", badgeBg: "var(--rpt-surface2)", badgeColor: "var(--rpt-text-tertiary)" },
  ];

  return (
    <div className="report-shell">
      {/* TOPBAR */}
      <div className="rpt-topbar-dark">
        <div className="rpt-topbar-row1">
          <div className="rpt-mode-badge">
            <div className="rpt-mode-dot" />
            Visão clínica
          </div>
          <button className="rpt-close-btn" onClick={handleClose}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Encerrar acesso
          </button>
        </div>
        <div className="rpt-patient-block">
          <div className="rpt-avatar-dark">{initials}</div>
          <div className="rpt-patient-info">
            <div className="rpt-patient-name-dark">{profile?.full_name || "Paciente"}</div>
            <div className="rpt-patient-meta-dark">{metaParts.join(" · ") || "Sem dados clínicos"}</div>
          </div>
          <div className="rpt-week-chip-dark">{formatDateRange()}</div>
        </div>
      </div>

      {/* TABS */}
      <div className="rpt-tabs-wrap">
        {TABS.map((t) => (
          <button key={t.id} className={`rpt-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: RESUMO */}
      {tab === "resumo" && (
        <>
          <div className="rpt-section" style={{ marginTop: 16 }}>
            <div className="rpt-section-label">Score geral</div>
            <div className="rpt-score-row">
              <div className="rpt-score-main">
                <ScoreRing score={s.score_general} size={72} strokeWidth={7} color={getScoreColor(s.score_general)} dark label="geral" />
                <div>
                  <div className="rpt-score-main-title">{scoreHeading}</div>
                  <div className="rpt-score-main-sub">{scoreSubtext}</div>
                </div>
              </div>
              <div className="rpt-subscore-stack">
                {[
                  { label: "Fisiol.", val: s.score_physiological },
                  { label: "Emoc.", val: s.score_emotional },
                  { label: "Estilo", val: s.score_lifestyle },
                ].map((sub) => (
                  <div key={sub.label} className="rpt-subscore-card">
                    <span className="rpt-ss-label">{sub.label}</span>
                    <div className="rpt-ss-bar-wrap"><div className="rpt-ss-bar"><div className="rpt-ss-fill" style={{ width: `${sub.val}%`, background: getScoreColor(sub.val) }} /></div></div>
                    <span className="rpt-ss-val" style={{ color: getScoreColor(sub.val) }}>{sub.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rpt-section" style={{ marginTop: 20 }}>
            <div className="rpt-section-label">Dados clínicos — acesso restrito</div>
            <div className="rpt-sensitive-banner">
              <div className="rpt-sensitive-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4V8C2 11.3 4.7 14.4 8 15C11.3 14.4 14 11.3 14 8V4L8 1Z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              </div>
              <div className="rpt-sensitive-text"><strong>Dados ocultos ao paciente.</strong> Pressão estimada, glicemia e SpO₂ são visíveis apenas ao profissional de saúde vinculado à consulta.</div>
            </div>
            <div className="rpt-vital-grid">
              <div className="rpt-vital-card">
                <span className="rpt-vital-icon">🩸</span>
                <div className="rpt-vital-val">--<span className="rpt-vital-unit">/--</span></div>
                <div className="rpt-vital-name">Pressão (mmHg)</div>
                <span className="rpt-vital-status" style={{ background: "var(--rpt-surface2)", color: "var(--rpt-text-tertiary)" }}>Sem dado</span>
              </div>
              <div className="rpt-vital-card">
                <span className="rpt-vital-icon">📊</span>
                <div className="rpt-vital-val">--<span className="rpt-vital-unit"> mg/dL</span></div>
                <div className="rpt-vital-name">Glicemia est.</div>
                <span className="rpt-vital-status" style={{ background: "var(--rpt-surface2)", color: "var(--rpt-text-tertiary)" }}>Sem dado</span>
              </div>
              <div className="rpt-vital-card">
                <span className="rpt-vital-icon">💨</span>
                <div className="rpt-vital-val">--<span className="rpt-vital-unit">%</span></div>
                <div className="rpt-vital-name">SpO₂</div>
                <span className="rpt-vital-status" style={{ background: "var(--rpt-surface2)", color: "var(--rpt-text-tertiary)" }}>Sem dado</span>
              </div>
            </div>
          </div>

          <div className="rpt-section" style={{ marginTop: 20 }}>
            <div className="rpt-section-label">Alertas clínicos prioritários</div>
            <div className="rpt-alerts">
              {displayAlerts.map((a, i) => <AlertCard key={i} text={a.text} subtext={a.subtext} severity={a.severity} />)}
            </div>
          </div>

          <div className="rpt-section" style={{ marginTop: 20 }}>
            <div className="rpt-section-label">Pontos para investigar na consulta</div>
            <div className="rpt-inv-list">
              <div className="rpt-inv-item">
                <div className="rpt-inv-num">1</div>
                <div className="rpt-inv-body">
                  <div className="rpt-inv-title">Sem dados suficientes</div>
                  <div className="rpt-inv-desc">Ainda não há medições ou questionários suficientes para gerar pontos de investigação clínica.</div>
                  <div className="rpt-inv-source">Fonte: sistema</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ height: 24 }} />
        </>
      )}

      {/* TAB: SINAIS */}
      {tab === "sinais" && (
        <div className="rpt-section" style={{ marginTop: 16 }}>
          <div className="rpt-section-label">Métricas clínicas — 7 dias</div>
          <div className="rpt-trend-table">
            {signalRows.map((row, i) => (
              <div key={i} className="rpt-trend-row">
                <div style={{ flex: 1 }}>
                  <div className="rpt-trend-metric">{row.metric}</div>
                  <div className="rpt-trend-source">{row.source}</div>
                </div>
                <div className="rpt-trend-vals">
                  <div className="rpt-trend-current">{row.current}</div>
                  <div className="rpt-trend-baseline">{row.baseline}</div>
                </div>
                <div className="rpt-trend-dir" style={{ color: row.dirColor }}>{row.dir}</div>
                <span className="rpt-trend-badge" style={{ background: row.badgeBg, color: row.badgeColor }}>{row.badge}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* TAB: HISTÓRICO */}
      {tab === "historico" && (
        <>
          <div className="rpt-section" style={{ marginTop: 16 }}>
            <div className="rpt-section-label">Linha do tempo — 7 dias</div>
            <div className="rpt-timeline">
              <TimelineItem
                day="Sem eventos registrados" event="Nenhuma medição ou questionário foi registrado nos últimos 7 dias."
                tag="Sem dado no período" tagColor="var(--rpt-text-tertiary)" tagBg="var(--rpt-surface2)"
                dotColor="var(--rpt-text-tertiary)" showLine={false}
              />
            </div>
          </div>

          <div className="rpt-section" style={{ marginTop: 20 }}>
            <div className="rpt-section-label">Consultas anteriores</div>
            <div className="rpt-consultas">
              <p style={{ fontSize: 13, color: "var(--rpt-text-secondary)", padding: "12px 0" }}>Nenhuma consulta anterior registrada.</p>
              <button className="rpt-nova-consulta-btn">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Registrar consulta atual
              </button>
            </div>
          </div>
          <div style={{ height: 24 }} />
        </>
      )}

      {/* TAB: NOTA CLÍNICA */}
      {tab === "nota" && (
        <div className="rpt-section" style={{ marginTop: 16 }}>
          <div className="rpt-section-label">Resumo para atendimento</div>

          {/* Conditions + Medications */}
          <div style={{ background: "var(--rpt-surface)", borderRadius: "var(--rpt-radius-md)", border: "1px solid var(--rpt-border)", padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--rpt-text-tertiary)", marginBottom: 12 }}>Condições ativas</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 14 }}>
              {conditions.length > 0 ? conditions.map((c, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 20, background: "var(--rpt-doctor-accent-light)", color: "var(--rpt-doctor-accent)" }}>{c}</span>
              )) : (
                <span style={{ fontSize: 12, color: "var(--rpt-text-tertiary)" }}>Nenhuma condição registrada</span>
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--rpt-text-tertiary)", marginBottom: 8 }}>Medicamentos em uso</div>
            <div style={{ fontSize: 12, color: "var(--rpt-text-tertiary)" }}>Sem registro de medicamentos</div>
          </div>

          <div className="rpt-section-label">Nota clínica da consulta</div>
          <div className="rpt-nota-card">
            <div className="rpt-nota-header">
              <span className="rpt-nota-title">Observações do profissional</span>
              <span className="rpt-nota-meta">{new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })} · Dr(a).</span>
            </div>
            <textarea
              className="rpt-nota-textarea"
              placeholder="Registre aqui as observações clínicas, condutas, encaminhamentos e orientações desta consulta."
              rows={6}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="rpt-nota-footer">
              <span className="rpt-nota-hint">Salvo automaticamente no histórico</span>
              <button className="rpt-nota-save-btn" onClick={handleSaveNote} disabled={saving}>
                {saving ? "Salvando..." : "Salvar nota"}
              </button>
            </div>
          </div>

          {/* Referrals */}
          <div style={{ marginTop: 14 }}>
            <div className="rpt-section-label">Encaminhamentos rápidos</div>
            <div className="rpt-referral-grid">
              {[
                { emoji: "🧘", label: "Psicólogo" },
                { emoji: "🥗", label: "Nutricionista" },
                { emoji: "🏃", label: "Ed. Físico" },
                { emoji: "🫀", label: "Cardiologista" },
              ].map((r) => (
                <button key={r.label} className="rpt-referral-btn" onClick={() => toast({ title: `Encaminhamento para ${r.label} registrado` })}>
                  <span className="rpt-referral-emoji">{r.emoji}</span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}
    </div>
  );
}
