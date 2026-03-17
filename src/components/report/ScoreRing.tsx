interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  dark?: boolean;
}

export function ScoreRing({
  score,
  size = 96,
  strokeWidth = 9,
  color = "var(--rpt-green)",
  trackColor,
  label = "geral",
  dark = false,
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(score, 100) / 100);

  const defaultTrack = dark ? "rgba(255,255,255,0.1)" : "var(--rpt-green-bg)";
  const numColor = dark ? "white" : "var(--rpt-text-primary)";
  const lblColor = dark ? "rgba(255,255,255,0.4)" : "var(--rpt-text-tertiary)";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={trackColor || defaultTrack}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
      }}>
        <span className="rpt-mono" style={{ fontSize: size * 0.27, fontWeight: 600, color: numColor, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: size * 0.1, color: lblColor, fontWeight: 500, letterSpacing: "0.06em", marginTop: 2 }}>
          {label}
        </span>
      </div>
    </div>
  );
}
