interface AlertCardProps {
  text: string;
  subtext: string;
  severity: "critical" | "warning" | "info" | "low";
}

const SEVERITY_MAP = {
  critical: { stripe: "var(--rpt-red)", bg: "var(--rpt-red-bg)", color: "var(--rpt-red)", label: "Crítico" },
  warning: { stripe: "var(--rpt-amber)", bg: "var(--rpt-amber-bg)", color: "var(--rpt-amber)", label: "Atenção" },
  info: { stripe: "var(--rpt-blue)", bg: "var(--rpt-blue-bg)", color: "var(--rpt-blue)", label: "Observar" },
  low: { stripe: "var(--rpt-green)", bg: "var(--rpt-green-bg)", color: "var(--rpt-green)", label: "Normal" },
};

export function AlertCard({ text, subtext, severity }: AlertCardProps) {
  const s = SEVERITY_MAP[severity];
  return (
    <div className="rpt-alert-card">
      <div className="rpt-alert-stripe" style={{ background: s.stripe }} />
      <div className="rpt-alert-body">
        <div className="rpt-alert-text">{text}</div>
        <div className="rpt-alert-sub">{subtext}</div>
      </div>
      <span className="rpt-alert-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
    </div>
  );
}
