import { useState } from "react";

interface BarData {
  value: number;
  rawValue: number;
  label: string; // e.g. "Seg 7/abr"
}

interface TrendCardProps {
  icon: React.ReactNode;
  iconBg: string;
  arrow: "↑" | "↓" | "→";
  arrowColor: string;
  value: string;
  unit?: string;
  name: string;
  bars: number[]; // 7 values 0-100 (percentage for bar height)
  barColor: string;
  barData?: BarData[]; // real values + labels for tooltip
  idealRange?: string; // e.g. "60-100 bpm"
  onInfoClick?: () => void;
}

export function TrendCard({ icon, iconBg, arrow, arrowColor, value, unit, name, bars, barColor, barData, idealRange, onInfoClick }: TrendCardProps) {
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  // Compute peak/valley from barData
  let peakLabel = "";
  let valleyLabel = "";
  if (barData && barData.length > 1) {
    let maxIdx = 0, minIdx = 0;
    barData.forEach((b, i) => {
      if (b.rawValue > barData[maxIdx].rawValue) maxIdx = i;
      if (b.rawValue < barData[minIdx].rawValue) minIdx = i;
    });
    if (barData[maxIdx].rawValue !== barData[minIdx].rawValue) {
      peakLabel = `↑ ${barData[maxIdx].rawValue}${unit ? " " + unit : ""} · ↓ ${barData[minIdx].rawValue}${unit ? " " + unit : ""}`;
    }
  }

  const tooltipData = selectedBar != null && barData && barData[selectedBar] ? barData[selectedBar] : null;

  return (
    <div className="rpt-trend-card" style={{ position: "relative" }}>
      <div className="rpt-trend-top">
        <div className="rpt-trend-icon" style={{ background: iconBg }}>{icon}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {onInfoClick && (
            <button className="rpt-info-btn" onClick={onInfoClick} aria-label={`Info ${name}`}>?</button>
          )}
          <span className="rpt-trend-arrow" style={{ color: arrowColor }}>{arrow}</span>
        </div>
      </div>
      <div>
        <span className="rpt-trend-val">{value}</span>
        {unit && <span className="rpt-trend-unit"> {unit}</span>}
      </div>
      <div className="rpt-trend-name">{name}</div>
      {idealRange && <div className="rpt-trend-ideal">Ideal: {idealRange}</div>}
      <div className="rpt-mini-chart">
        {bars.map((h, i) => (
          <div
            key={i}
            className={i === bars.length - 1 ? "rpt-bar-today" : "rpt-bar"}
            style={{
              height: `${h}%`,
              background: barColor,
              cursor: barData ? "pointer" : undefined,
              outline: selectedBar === i ? `2px solid ${barColor}` : undefined,
              outlineOffset: 1,
              borderRadius: "2px 2px 0 0",
            }}
            onClick={() => barData && setSelectedBar(selectedBar === i ? null : i)}
          />
        ))}
      </div>
      {tooltipData && (
        <div className="rpt-bar-tooltip" style={{ borderLeftColor: barColor }}>
          <span className="rpt-bar-tooltip-label">{tooltipData.label}</span>
          <span className="rpt-bar-tooltip-value">{tooltipData.rawValue}{unit ? ` ${unit}` : ""}</span>
        </div>
      )}
      {peakLabel && !tooltipData && (
        <div className="rpt-peak-valley">{peakLabel}</div>
      )}
    </div>
  );
}
