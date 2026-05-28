import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, pointsFor, rankFor } from "@/hooks/useLeaderboard";
import { markFirstStep } from "@/lib/first-steps";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFull: () => void;
}

import { Avatar } from "./MaylaIcons";
import { getInitials as initials, hasCustomAvatar } from "@/lib/avatar";

export function RankingQuickView({ open, onOpenChange, onOpenFull }: Props) {
  const { user } = useAuth();
  const { rows, loading } = useLeaderboard("week", 10);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl overflow-y-auto bg-background border-border">
        <SheetHeader>
          <SheetTitle className="font-display text-lg text-foreground">🏆 Ranking da semana</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-xl shadow-sm p-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum resultado ainda esta semana.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((r) => {
              const isMe = r.user_id === user?.id;
              return (
                <div
                  key={r.user_id}
                  className={`rounded-xl shadow-sm p-3 flex items-center gap-3 ${
                    isMe ? "bg-primary/10 border-l-[3px] border-primary" : "bg-card"
                  }`}
                >
                  <div className="w-6 text-center text-sm font-medium text-muted-foreground">
                    {rankFor(r, "week")}
                  </div>
                  {hasCustomAvatar(r.avatar_url, r.avatar_type) ? (
                    <Avatar initials={initials(r.full_name)} size={36} avatarUrl={r.avatar_url} avatarType={r.avatar_type} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-display font-semibold">
                      {initials(r.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{pointsFor(r, "week").toLocaleString()} pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => { onOpenChange(false); onOpenFull(); }}
          className="mt-5 w-full rounded-xl py-3 text-sm font-semibold bg-primary text-primary-foreground border-none cursor-pointer"
        >
          Ver ranking completo →
        </button>
      </SheetContent>
    </Sheet>
  );
}
