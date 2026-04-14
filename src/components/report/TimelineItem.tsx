interface VitalChip {
  label: string;
  value: string;
  color: string;
  bg: string;
}

interface TimelineGroupProps {
  dayLabel: string;
  entries: {
    time: string;
    source: string;
    chips: VitalChip[];
  }[];
}

export function TimelineGroup({ dayLabel, entries }: TimelineGroupProps) {
  return (
    <div className="rpt-tl-group">
      <div className="rpt-tl-day-header">{dayLabel}</div>
      {entries.map((entry, i) => (
        <div key={i} className="rpt-tl-card">
          <div className="rpt-tl-card-header">
            <span className="rpt-tl-time">{entry.time}</span>
            <span className="rpt-tl-source">{entry.source}</span>
          </div>
          <div className="rpt-tl-chips">
            {entry.chips.map((chip, j) => (
              <span key={j} className="rpt-tl-chip" style={{ background: chip.bg, color: chip.color }}>
                {chip.label} {chip.value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Keep legacy export for compatibility
interface TimelineItemProps {
  day: string;
  event: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  dotColor: string;
  showLine?: boolean;
}

export function TimelineItem({ day, event, tag, tagColor, tagBg, dotColor, showLine = true }: TimelineItemProps) {
  return (
    <div className="rpt-tl-item">
      <div className="rpt-tl-left">
        <div className="rpt-tl-dot" style={{ background: dotColor }} />
        {showLine && <div className="rpt-tl-line" />}
      </div>
      <div className="rpt-tl-right" style={!showLine ? { paddingBottom: 0 } : undefined}>
        <div className="rpt-tl-day">{day}</div>
        <div className="rpt-tl-event">{event}</div>
        <span className="rpt-tl-tag" style={{ background: tagBg, color: tagColor }}>{tag}</span>
      </div>
    </div>
  );
}
