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
