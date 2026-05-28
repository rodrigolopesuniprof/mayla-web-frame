import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, pointsFor, rankFor, goalFor, type LeaderboardPeriod, type LeaderboardRow } from "@/hooks/useLeaderboard";
import { DailyChallengeCard } from "./DailyChallengeCard";
import { Avatar } from "./MaylaIcons";
import { getInitials as initials, hasCustomAvatar } from "@/lib/avatar";

interface Props { onBack: () => void; }

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const currentMonthName = MONTH_NAMES[new Date().getMonth()];
const currentYear = new Date().getFullYear();

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: "Semana",
  month: currentMonthName,
  year: String(currentYear),
  total: "Geral",
};

const GOAL_LABELS: Record<LeaderboardPeriod, string> = {
  week: "semanal",
  month: `de ${currentMonthName.toLowerCase()}`,
  year: `de ${currentYear}`,
  total: "",
};

export function LeaderboardScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { rows, goals, loading } = useLeaderboard(period);

  const myRow = rows.find((r) => r.user_id === user?.id);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const goal = goalFor(goals, period);
  const myPoints = myRow ? pointsFor(myRow, period) : 0;
  const pct = goal && goal > 0 ? Math.min(100, Math.round((myPoints / goal) * 100)) : 0;
  const remaining = goal ? Math.max(0, goal - myPoints) : 0;

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-6 bg-background">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 relative">
        <button onClick={onBack} className="text-sm text-foreground bg-transparent border-none cursor-pointer p-1">
          ← Voltar
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground absolute left-1/2 -translate-x-1/2">
          Ranking
        </h1>
      </div>

      {/* Period segmented control */}
      <div className="px-5 pt-2">
        <div className="flex gap-1 p-1 bg-card rounded-full border border-border">
          {(["week", "month", "year"] as LeaderboardPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border-none ${
                period === p ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPeriod("total")}
          className={`mt-2 text-[11px] font-medium cursor-pointer bg-transparent border-none ${
            period === "total" ? "text-primary underline" : "text-muted-foreground"
          }`}
        >
          {period === "total" ? "✓ vendo ranking geral" : "ver ranking geral"}
        </button>
      </div>

      {/* Goal progress card */}
      {period !== "total" && goal !== null && (
        <div className="mx-5 mt-4 bg-card rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] font-semibold tracking-[.1em] uppercase text-muted-foreground">
                Sua meta {GOAL_LABELS[period]}
              </div>
              <div className="text-[15px] font-semibold text-foreground mt-0.5">
                {myPoints.toLocaleString()} / {goal.toLocaleString()} pts
              </div>
            </div>
            <div className="text-2xl">{remaining === 0 ? "🎉" : "🎯"}</div>
          </div>
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">
            {remaining === 0
              ? "Meta atingida! Continue acumulando pontos."
              : `Faltam ${remaining.toLocaleString()} pts para a meta ${GOAL_LABELS[period]}`}
          </div>
        </div>
      )}

      {/* Daily challenge */}
      <div className="mt-4 -mb-1">
        <DailyChallengeCard />
      </div>

      {loading ? (
        <div className="px-5 mt-2 space-y-4">
          <div className="bg-card rounded-2xl shadow-sm p-5 grid grid-cols-3 gap-3 items-end">
            {[48, 64, 48].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="rounded-full" style={{ width: s, height: s }} />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-xl shadow-sm p-3 flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 px-8 text-center flex flex-col items-center gap-2">
          <div className="text-6xl mb-2">🏆</div>
          <div className="text-foreground font-medium">Nenhum resultado ainda</div>
          <div className="text-sm text-muted-foreground">
            Complete missões e desafios para aparecer no ranking
          </div>
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="mx-5 mt-4 bg-card rounded-2xl shadow-sm p-5">
              <div className="grid grid-cols-3 gap-3 items-end">
                {[1, 0, 2].map((idx) => {
                  const r = podium[idx];
                  if (!r) return <div key={idx} />;
                  const isFirst = idx === 0;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                  const size = isFirst ? 64 : 48;
                  return (
                    <div key={r.user_id} className={`flex flex-col items-center ${isFirst ? "-mt-2" : ""}`}>
                      <div className="relative">
                        {hasCustomAvatar(r.avatar_url, r.avatar_type) ? (
                          <Avatar
                            initials={initials(r.full_name)}
                            size={size}
                            avatarUrl={r.avatar_url}
                            avatarType={r.avatar_type}
                          />
                        ) : (
                          <div
                            className={`rounded-full flex items-center justify-center font-display font-semibold ${
                              isFirst ? "bg-primary text-primary-foreground text-xl" : "bg-secondary text-secondary-foreground text-base"
                            }`}
                            style={{ width: size, height: size }}
                          >
                            {initials(r.full_name)}
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1 text-xl">{medal}</div>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground text-center truncate w-full px-1">
                        {r.full_name?.split(" ")[0] || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pointsFor(r, period).toLocaleString()} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="px-5 mt-4 space-y-2">
              {rest.map((r) => {
                const isMe = r.user_id === user?.id;
                return (
                  <div
                    key={r.user_id}
                    className={`rounded-xl shadow-sm p-3 flex items-center gap-3 ${
                      isMe ? "bg-primary/10 border-l-[3px] border-primary" : "bg-card"
                    }`}
                  >
                    <div className="w-6 text-center text-sm font-medium text-muted-foreground">
                      {rankFor(r, period)}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-display font-semibold">
                      {initials(r.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{r.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {pointsFor(r, period).toLocaleString()} pts
                      </div>
                    </div>
                    {r.current_level && (
                      <div className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        Nível {r.current_level}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {myRow && rankFor(myRow, period) > 3 && (
            <div className="sticky bottom-0 mt-4 px-5 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent">
              <div className="rounded-xl border-l-[3px] border-primary bg-primary/10 shadow-sm p-3 flex items-center gap-3">
                <div className="w-6 text-center text-sm font-bold text-primary">
                  {rankFor(myRow, period)}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-semibold">
                  {initials(myRow.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Você</div>
                  <div className="text-xs text-muted-foreground">
                    {pointsFor(myRow, period).toLocaleString()} pts
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
