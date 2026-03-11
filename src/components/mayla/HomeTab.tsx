import { useState, useEffect } from "react";
import type { TabId } from "@/lib/mayla-config";
import { BrandBadge, Avatar } from "./MaylaIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  emoji: string;
  color: string;
  external_url: string | null;
  scope: string;
}

export function HomeTab({ setTab, onOpenTelemedicine, onOpenAppointment, onOpenEsfLink }: { setTab: (id: TabId) => void; onOpenTelemedicine: () => void; onOpenAppointment: () => void; onOpenEsfLink: () => void }) {
  const { isDefault } = useCompany();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<NotificationItem | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setProfileName(data.full_name);
      });

    supabase
      .from("notifications")
      .select("id, title, body, emoji, color, external_url, scope")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAlerts(data);
      });
  }, [user]);

  const [profilePoints, setProfilePoints] = useState(0);
  const [profileLevel, setProfileLevel] = useState("Colaborador");
  const [hasEsf, setHasEsf] = useState(true); // default true to avoid flash

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("points, level, esf_team_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfilePoints(data.points);
          setProfileLevel(data.level);
          setHasEsf(!!(data as any).esf_team_id);
        }
      });
  }, [user]);

  const fullName = profileName || user?.user_metadata?.full_name || "Cidadão";
  const firstName = fullName.split(" ")[0];
  const points = profilePoints;
  const healthScore = 82;

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      {/* Header */}
      <div className="px-[22px] py-[14px] pb-3 flex items-center justify-between border-b border-border relative overflow-hidden">
        <div
          className="absolute animate-morph"
          style={{
            top: -50, right: -50, width: 160, height: 160,
            background: "radial-gradient(circle at 40% 40%, hsl(var(--mayla-pref-lt)), hsl(var(--mayla-pref)))",
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            opacity: 0.09, zIndex: 0,
          }}
        />
        <div className="relative z-[1]"><BrandBadge height={38} /></div>
        <Avatar />
      </div>

      {/* Greeting */}
      <div className="px-[22px] pt-5 pb-3.5">
        <p className="font-display text-[26px] font-medium text-foreground leading-[1.25]">
          Olá, <em className="italic text-accent">{firstName}</em> 👋
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Municipality linking warning */}
      {isDefault && (
        <div className="mx-[22px] mb-5 rounded-[18px] px-[18px] py-4 flex items-center gap-3.5 border-2 border-dashed border-accent/40 bg-accent/5">
          <div
            className="shrink-0 flex items-center justify-center text-[22px]"
            style={{ width: 46, height: 46, borderRadius: 14, background: "hsl(var(--accent) / .15)" }}
          >
            ⚠️
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-foreground mb-0.5">Vincule-se a um município</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              Preencha seu CEP no questionário de saúde para ser vinculado automaticamente, ou vincule-se a uma ESF.
            </div>
          </div>
          <span
            className="text-[11px] text-accent font-semibold cursor-pointer whitespace-nowrap"
            onClick={onOpenEsfLink}
          >
            Vincular →
          </span>
        </div>
      )}

      {/* Health Score Card */}
      <div className="mx-[22px] mb-5 bg-secondary rounded-[18px] overflow-hidden">
        <div className="p-[14px_18px_10px] flex items-center gap-3.5">
          <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
            <svg width="52" height="52" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="26" cy="26" r="21" fill="none" stroke="hsl(var(--mayla-sand))" strokeWidth="4.5" />
              <circle
                cx="26" cy="26" r="21" fill="none"
                stroke="hsl(var(--mayla-green))" strokeWidth="4.5"
                strokeDasharray={`${2 * Math.PI * 21}`}
                strokeDashoffset={`${2 * Math.PI * 21 * (1 - healthScore / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-foreground">
              {healthScore}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-muted-foreground tracking-[.07em] uppercase mb-0.5">Saúde hoje</div>
            <div className="font-display text-[17px] text-foreground font-medium">Muito bem! 💪</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Medição de ontem · 87 bpm</div>
          </div>
          <button
            onClick={() => setTab("saude")}
            className="border-none rounded-xl px-3 py-2 text-accent-foreground text-[11px] font-semibold cursor-pointer"
            style={{ background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))" }}
          >
            Medir →
          </button>
        </div>
        <div className="border-t border-foreground/10 px-[18px] py-2.5 flex items-center gap-2">
          <span className="text-sm">⭐</span>
          <span className="text-xs font-semibold text-secondary-foreground">{points.toLocaleString()} pontos</span>
          <span className="text-[11px] text-muted-foreground ml-0.5">· nível {profileLevel}</span>
          <span
            className="ml-auto text-[11px] text-accent font-medium cursor-pointer"
            onClick={() => setTab("missoes")}
          >
            Ver missões →
          </span>
        </div>
      </div>

      {/* Telemedicina & Agendamento Cards */}
      <div className="mx-[22px] mb-5 grid grid-cols-2 gap-3">
        <div
          className="rounded-[18px] p-4 cursor-pointer active:scale-[.97] transition-transform"
          style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
          onClick={onOpenTelemedicine}
        >
          <span className="text-2xl block mb-2">📹</span>
          <span className="text-[13px] font-semibold text-primary-foreground block">Telemedicina</span>
          <span className="text-[10px] block mt-0.5" style={{ color: "rgba(255,255,255,.65)" }}>Consulta online</span>
        </div>
        <div
          className="rounded-[18px] p-4 cursor-pointer active:scale-[.97] transition-transform"
          style={{ background: "linear-gradient(135deg, hsl(var(--mayla-teal)), #2A9A94)" }}
          onClick={onOpenAppointment}
        >
          <span className="text-2xl block mb-2">📋</span>
          <span className="text-[13px] font-semibold text-primary-foreground block">Agendar Consulta</span>
          <span className="text-[10px] block mt-0.5" style={{ color: "rgba(255,255,255,.65)" }}>Presencial na UBS</span>
        </div>
      </div>

      {/* ESF Link CTA */}
      {!hasEsf && (
        <div
          className="mx-[22px] mb-5 rounded-[18px] px-[18px] py-4 flex items-center gap-3.5 cursor-pointer active:scale-[.97] transition-transform border-2 border-dashed border-primary/30 bg-primary/5"
          onClick={onOpenEsfLink}
        >
          <div
            className="shrink-0 flex items-center justify-center text-[22px]"
            style={{ width: 46, height: 46, borderRadius: 14, background: "hsl(var(--primary) / .15)" }}
          >
            🏥
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-foreground mb-0.5">Vincule-se à sua ESF</div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              Escaneie o QR Code na unidade · ganhe +500 pts
            </div>
          </div>
          <span className="text-lg text-primary font-bold">›</span>
        </div>
      )}

      {/* rPPG CTA */}
      <div
        className="mx-[22px] mb-5 rounded-[18px] px-[18px] py-4 flex items-center gap-3.5 relative overflow-hidden cursor-pointer"
        style={{ background: "linear-gradient(135deg, hsl(var(--mayla-ink)), #3D2820)" }}
        onClick={() => setTab("saude")}
      >
        <div className="absolute rounded-full" style={{ top: -20, right: -20, width: 90, height: 90, background: "rgba(255,255,255,.04)" }} />
        <div
          className="shrink-0 flex items-center justify-center text-[22px]"
          style={{
            width: 46, height: 46, borderRadius: 14,
            background: "linear-gradient(135deg, hsl(var(--mayla-rose)), hsl(var(--mayla-rose-lt)))",
          }}
        >
          📷
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-primary-foreground mb-0.5">Fazer medição de hoje</div>
          <div className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,.55)" }}>
            30 segundos · câmera rPPG · ganhe +50 pts
          </div>
        </div>
        <span style={{ fontSize: 18, color: "rgba(255,255,255,.4)" }}>›</span>
      </div>

      {/* Next Appointment */}
      <div className="mx-[22px] mb-5 bg-card rounded-[18px] p-[14px_16px] flex items-center gap-3.5 border border-border">
        <div
          className="shrink-0 flex flex-col items-center justify-center"
          style={{
            width: 44, height: 44, borderRadius: 14,
            background: "linear-gradient(135deg, hsl(var(--mayla-teal)), #2A9A94)",
          }}
        >
          <span className="text-[9px] uppercase" style={{ color: "rgba(255,255,255,.7)" }}>MAR</span>
          <span className="font-display text-lg font-bold leading-none" style={{ color: "#fff" }}>05</span>
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-muted-foreground mb-0.5">Próxima consulta</div>
          <div className="text-[13px] font-semibold text-foreground">Clínica Geral — Dr. Farias</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">UBS São Jorge · 10h30</div>
        </div>
        <span className="text-lg text-muted-foreground">›</span>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="px-[22px]">
          <p className="text-[11px] font-medium text-muted-foreground tracking-[.1em] uppercase mb-3.5">
            Informações importantes
          </p>
          <div className="flex flex-col gap-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-secondary rounded-2xl p-[13px_15px] flex items-start gap-3 cursor-pointer active:opacity-80 transition-opacity"
                style={{ borderLeft: `3px solid hsl(${alert.color})` }}
                onClick={() => setSelectedAlert(alert)}
              >
                <span className="text-lg shrink-0 mt-0.5">{alert.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-[7px] flex-wrap mb-0.5">
                    <span className="text-[13px] font-semibold text-foreground">{alert.title}</span>
                    <span
                      className="text-[9px] font-semibold rounded-md px-[7px] py-px tracking-[.06em] uppercase"
                      style={{ color: `hsl(${alert.color})`, background: `hsl(${alert.color} / .1)` }}
                    >
                      {alert.scope === "municipal" ? "Prefeitura" : "Você"}
                    </span>
                  </div>
                  {alert.body && <div className="text-[11px] text-muted-foreground leading-snug">{alert.body}</div>}
                </div>
                <span className="text-lg text-muted-foreground mt-0.5">›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Detail Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedAlert?.emoji}</span>
              <span>{selectedAlert?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedAlert?.body && (
            <p className="text-sm text-muted-foreground">{selectedAlert.body}</p>
          )}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold rounded-md px-2 py-0.5 tracking-[.06em] uppercase"
              style={{
                color: selectedAlert ? `hsl(${selectedAlert.color})` : undefined,
                background: selectedAlert ? `hsl(${selectedAlert.color} / .1)` : undefined,
              }}
            >
              {selectedAlert?.scope === "municipal" ? "Prefeitura" : "Você"}
            </span>
          </div>
          {selectedAlert?.external_url && (
            <a
              href={selectedAlert.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Abrir link externo →
            </a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
