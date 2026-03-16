import { Button } from "@/components/ui/button";
import {
  type Partner,
  MARKER_COLORS,
  MARKER_EMOJIS,
  TYPE_LABELS,
  formatDistance,
} from "@/lib/partner-helpers";

interface Props {
  partner: Partner;
  selected: boolean;
  onSelect: (p: Partner) => void;
  onDetail: (p: Partner) => void;
}

export function PartnerCard({ partner: p, selected, onSelect, onDetail }: Props) {
  return (
    <button
      id={`partner-card-${p.id}`}
      onClick={() => onSelect(p)}
      className={`w-full text-left rounded-xl p-3.5 border cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {p.logo_url ? (
          <img
            src={p.logo_url}
            alt={p.name}
            className="w-11 h-11 rounded-full object-cover shrink-0 border border-border"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0"
            style={{ background: `${MARKER_COLORS[p.partner_type]}15` }}
          >
            {MARKER_EMOJIS[p.partner_type]}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {TYPE_LABELS[p.partner_type]}
            </span>
            {p.specialty && (
              <span className="text-[10px] text-muted-foreground truncate">{p.specialty}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {p.distance != null && p.distance < Infinity && (
              <span className="text-[11px] text-muted-foreground">📏 {formatDistance(p.distance)}</span>
            )}
            {p.consultation_price != null && (
              <span className="text-[11px] font-semibold text-foreground">R$ {p.consultation_price.toFixed(0)}</span>
            )}
            {p.online_consultation_enabled && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                Online
              </span>
            )}
            {/* Future: rating badge */}
            {/* {p.avg_rating && <span className="text-[10px]">⭐ {p.avg_rating.toFixed(1)}</span>} */}
          </div>
        </div>

        {/* Action */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs h-8"
          onClick={(e) => {
            e.stopPropagation();
            onDetail(p);
          }}
        >
          Ver →
        </Button>
      </div>
    </button>
  );
}
