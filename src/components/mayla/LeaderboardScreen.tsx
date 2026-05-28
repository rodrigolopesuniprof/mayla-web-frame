import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

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

export function LeaderboardScreen({ onBack }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [rows, setRows] = useState<Row[]>([]);
  const [period, setPeriod] = useState<Period>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
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
    <div className="animate-fade-up flex-1 overflow-y-auto pb-4">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} className="text-sm text-primary bg-transparent border-none cursor-pointer">← Voltar</button>
        <h1 className="font-display text-lg font-medium text-foreground">Ranking</h1>
      </div>

      <div className="px-5 pt-4 flex gap-2">
        {(["month", "total"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium border cursor-pointer ${
              period === p ? "bg-accent text-accent-foreground border-accent" : "bg-card text-muted-foreground border-border"
            }`}
          >
            {p === "month" ? "Este mês" : "Geral"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground px-8">
          Ainda não há pontuação registrada. Conclua o desafio do dia ou meça seus sinais para começar a aparecer no ranking.
        </div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="px-5 mt-4 grid grid-cols-3 gap-2 items-end">
              {[1, 0, 2].map((idx) => {
                const r = podium[idx];
                if (!r) return <div key={idx} />;
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                const h = idx === 0 ? 120 : idx === 1 ? 100 : 80;
                return (
                  <div key={r.user_id} className="flex flex-col items-center">
                    <div className="text-2xl mb-1">{medal}</div>
                    <div className="text-[11px] font-semibold text-foreground text-center truncate w-full px-1">
                      {r.full_name?.split(" ")[0] || "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mb-1">{points(r).toLocaleString()} pts</div>
                    <div className="w-full rounded-t-xl bg-gradient-to-t from-accent/30 to-accent/10 border-t border-x border-accent/30"
                         style={{ height: h }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Rest */}
          <div className="px-5 mt-5 space-y-2">
            {rest.map((r) => (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 p-3 rounded-2xl border ${
                  r.user_id === user?.id ? "border-accent bg-accent/10" : "border-border bg-card"
                }`}
              >
                <div className="w-7 text-center text-sm font-semibold text-muted-foreground">{rank(r)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.full_name || "—"}</div>
                  {r.current_level && <div className="text-[10px] text-muted-foreground">Nível {r.current_level}</div>}
                </div>
                <div className="text-sm font-semibold text-foreground">{points(r).toLocaleString()} pts</div>
              </div>
            ))}
          </div>

          {/* Sticky self position */}
          {myRank && rank(myRank) > 3 && (
            <div className="sticky bottom-0 mt-4 px-5 pb-3 pt-2 bg-gradient-to-t from-background to-background/80">
              <div className="rounded-2xl border-2 border-accent bg-accent/10 p-3 flex items-center gap-3">
                <div className="w-7 text-center text-sm font-bold text-accent">{rank(myRank)}</div>
                <div className="flex-1 text-sm font-semibold text-foreground">Você</div>
                <div className="text-sm font-bold text-foreground">{points(myRank).toLocaleString()} pts</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
