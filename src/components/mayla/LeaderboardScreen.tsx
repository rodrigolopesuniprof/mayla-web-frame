import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";

interface Row {
  user_id: string;
  full_name: string | null;
  total_points: number;
  month_points: number;
  current_level: number | null;
  rank_total: number;
  rank_month: number;
}

type Period = "month" | "total";

interface Props { onBack: () => void; }

function initials(name?: string | null) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "—";
}

export function LeaderboardScreen({ onBack }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<Row[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const order = period === "month" ? "month_points" : "total_points";
    supabase
      .from("company_leaderboard" as any)
      .select("user_id, full_name, total_points, month_points, current_level, rank_total, rank_month")
      .eq("company_id", companyId)
      .order(order, { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows(((data as unknown) as Row[]) || []);
        setLoading(false);
      });
  }, [companyId, period]);

  const myRank = rows.find((r) => r.user_id === user?.id);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const points = (r: Row) => period === "month" ? r.month_points : r.total_points;
  const rank = (r: Row) => period === "month" ? r.rank_month : r.rank_total;

  return (
    <div className="animate-fade-up flex-1 overflow-y-auto pb-6 bg-background">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 relative">
        <button
          onClick={onBack}
          className="text-sm text-foreground bg-transparent border-none cursor-pointer p-1"
        >
          ← Voltar
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground absolute left-1/2 -translate-x-1/2">
          Ranking
        </h1>
      </div>

      {/* Toggle */}
      <div className="px-5 pt-2 flex gap-2">
        {(["month", "total"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground border border-primary"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {p === "month" ? "Este mês" : "Geral"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="px-5 mt-5 space-y-4">
          {/* Podium skeleton */}
          <div className="bg-card rounded-2xl shadow-sm p-5 grid grid-cols-3 gap-3 items-end">
            {[48, 64, 48].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="rounded-full" style={{ width: s, height: s }} />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
          {/* List skeleton */}
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
          {/* Podium */}
          {podium.length > 0 && (
            <div className="mx-5 mt-5 bg-card rounded-2xl shadow-sm p-5">
              <div className="grid grid-cols-3 gap-3 items-end">
                {[1, 0, 2].map((idx) => {
                  const r = podium[idx];
                  if (!r) return <div key={idx} />;
                  const isFirst = idx === 0;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                  const size = isFirst ? 64 : 48;
                  return (
                    <div
                      key={r.user_id}
                      className={`flex flex-col items-center ${isFirst ? "-mt-2" : ""}`}
                    >
                      <div className="relative">
                        <div
                          className={`rounded-full flex items-center justify-center font-display font-semibold ${
                            isFirst
                              ? "bg-primary text-primary-foreground text-xl"
                              : "bg-secondary text-secondary-foreground text-base"
                          }`}
                          style={{ width: size, height: size }}
                        >
                          {initials(r.full_name)}
                        </div>
                        <div className="absolute -top-1 -right-1 text-xl">{medal}</div>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground text-center truncate w-full px-1">
                        {r.full_name?.split(" ")[0] || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {points(r).toLocaleString()} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List */}
          {rest.length > 0 && (
            <div className="px-5 mt-4 space-y-2">
              {rest.map((r) => {
                const isMe = r.user_id === user?.id;
                return (
                  <div
                    key={r.user_id}
                    className={`rounded-xl shadow-sm p-3 flex items-center gap-3 ${
                      isMe
                        ? "bg-primary/10 border-l-[3px] border-primary"
                        : "bg-card"
                    }`}
                  >
                    <div className="w-6 text-center text-sm font-medium text-muted-foreground">
                      {rank(r)}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-display font-semibold">
                      {initials(r.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {r.full_name || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {points(r).toLocaleString()} pts
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

          {/* Sticky self position */}
          {myRank && rank(myRank) > 3 && (
            <div className="sticky bottom-0 mt-4 px-5 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent">
              <div className="rounded-xl border-l-[3px] border-primary bg-primary/10 shadow-sm p-3 flex items-center gap-3">
                <div className="w-6 text-center text-sm font-bold text-primary">
                  {rank(myRank)}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-display font-semibold">
                  {initials(myRank.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Você</div>
                  <div className="text-xs text-muted-foreground">
                    {points(myRank).toLocaleString()} pts
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
