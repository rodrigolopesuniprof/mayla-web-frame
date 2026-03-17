interface TrendCardProps {
  icon: React.ReactNode;
  iconBg: string;
  arrow: "↑" | "↓" | "→";
  arrowColor: string;
  value: string;
  unit?: string;
  name: string;
  bars: number[]; // 7 values 0-100
  barColor: string;
}

export function TrendCard({ icon, iconBg, arrow, arrowColor, value, unit, name, bars, barColor }: TrendCardProps) {
  return (
    <div className="rpt-trend-card">
      <div className="rpt-trend-top">
        <div className="rpt-trend-icon" style={{ background: iconBg }}>{icon}</div>
        <span className="rpt-trend-arrow" style={{ color: arrowColor }}>{arrow}</span>
      </div>
      <div>
        <span className="rpt-trend-val">{value}</span>
        {unit && <span className="rpt-trend-unit"> {unit}</span>}
      </div>
      <div className="rpt-trend-name">{name}</div>
      <div className="rpt-mini-chart">
        {bars.map((h, i) => (
          <div
            key={i}
            className={i === bars.length - 1 ? "rpt-bar-today" : "rpt-bar"}
            style={{ height: `${h}%`, background: barColor }}
          />
        ))}
      </div>
    </div>
  );
}
