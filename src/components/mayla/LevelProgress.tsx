import { useGamification } from "@/hooks/useGamification";

export function LevelProgress() {
  const { progress, loading } = useGamification();
  if (loading || !progress || !progress.current) return null;

  const { current, next, points, badges } = progress;
  const min = current.min_points;
  const max = next ? next.min_points : Math.max(min + 1, points);
  const range = Math.max(max - min, 1);
  const pct = next ? Math.min(100, Math.round(((points - min) / range) * 100)) : 100;
  const remaining = next ? Math.max(0, next.min_points - points) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{current.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold tracking-[.1em] uppercase text-muted-foreground">Seu nível</div>
          <div className="text-[15px] font-semibold text-foreground">Nível {current.level_number} · {current.name}</div>
        </div>
      </div>

      <div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground mt-1.5">
          {next
            ? `Faltam ${remaining.toLocaleString()} pts para ${next.emoji} ${next.name}`
            : "Você está no nível máximo 🎉"}
        </div>
      </div>

      {badges.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold tracking-[.1em] uppercase text-muted-foreground mb-1.5">Badges</div>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b: any, i: number) => (
              <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-accent/10 text-accent font-medium border border-accent/20">
                {b.emoji} {b.title || b.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
