import { Button } from "@/components/ui/button";
import { useGamification } from "@/hooks/useGamification";
import { useMyRanking } from "@/hooks/useMyRanking";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  onOpenLeaderboard?: () => void;
  onOpenChallenges?: () => void;
}

export function GamificationStatusCard({ onOpenLeaderboard, onOpenChallenges }: Props) {
  const { progress, challenge, loading } = useGamification();
  const { rankWeek } = useMyRanking();
  const { streak } = useDailyStreak();

  if (loading || !progress) {
    return (
      <div className="mx-5 mb-5 bg-card rounded-2xl shadow-sm p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }

  const points = progress.points;
  const current = progress.current;
  const next = progress.next;

  const currentMin = current?.min_points ?? 0;
  const nextMin = next?.min_points ?? null;
  const span = nextMin !== null ? Math.max(1, nextMin - currentMin) : 1;
  const done = Math.max(0, points - currentMin);
  const pct = nextMin !== null ? Math.min(100, Math.round((done / span) * 100)) : 100;
  const remaining = nextMin !== null ? Math.max(0, nextMin - points) : 0;

  const levelLabel = current
    ? `${current.emoji ?? ""} Nível ${current.level_number} · ${current.name}`.trim()
    : "Sem nível ainda";

  return (
    <div className="mx-5 mb-5 bg-card rounded-2xl shadow-sm p-4">
      {/* Zona 1: identidade + posição */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold">
          {levelLabel}
        </div>
        {rankWeek ? (
          <button
            onClick={onOpenLeaderboard}
            className="text-sm text-muted-foreground bg-transparent border-none p-0 cursor-pointer hover:text-foreground transition-colors"
          >
            🏅 #{rankWeek} da semana →
          </button>
        ) : onOpenLeaderboard ? (
          <button
            onClick={onOpenLeaderboard}
            className="text-sm text-muted-foreground bg-transparent border-none p-0 cursor-pointer hover:text-foreground transition-colors"
          >
            🏆 Ranking →
          </button>
        ) : null}
      </div>

      {/* Zona 2: progresso */}
      <div className="mt-3">
        {next ? (
          <>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              <span className="font-semibold text-foreground">{points.toLocaleString()}</span>
              {" / "}{nextMin!.toLocaleString()} pts · Faltam{" "}
              <span className="font-semibold text-foreground">{remaining.toLocaleString()}</span>{" "}
              pts para {next.emoji ?? ""} {next.name}
            </div>
          </>
        ) : (
          <div className="text-sm font-medium text-foreground">
            🏆 Nível máximo atingido · {points.toLocaleString()} pts
          </div>
        )}
      </div>

      {/* Divisor */}
      <div className="border-t border-border/50 my-3" />

      {/* Zona 3: streak + desafio */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          {streak >= 1 ? (
            <span className="font-medium text-foreground">
              🔥 {streak} dia{streak > 1 ? "s" : ""} seguido{streak > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">Comece sua sequência hoje 💪</span>
          )}
        </div>
        {challenge ? (
          challenge.completed ? (
            <Button variant="outline" size="sm" disabled className="text-mayla-green border-mayla-green/40">
              ✓ Concluído hoje
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onOpenChallenges}>
              Desafio de hoje →
            </Button>
          )
        ) : onOpenChallenges ? (
          <Button variant="outline" size="sm" onClick={onOpenChallenges}>
            Ver missões →
          </Button>
        ) : null}
      </div>
    </div>
  );
}
