import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LevelUpInfo {
  level_number: number;
  name: string;
  emoji: string | null;
  badge_title: string | null;
  bonus_points: number;
}

interface Props {
  open: boolean;
  info: LevelUpInfo | null;
  onClose: () => void;
}

export function LevelUpDialog({ open, info, onClose }: Props) {
  if (!info) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent pointer-events-none" />
        <div className="relative space-y-4 py-2">
          <div className="text-xs font-bold tracking-[.2em] uppercase text-primary">
            🎉 Parabéns!
          </div>
          <div className="text-base font-semibold text-foreground">
            Você subiu de nível!
          </div>
          <div className="text-7xl animate-bounce" style={{ animationDuration: "1.4s" }}>
            {info.emoji || "🏆"}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Nível {info.level_number}</div>
            <div className="text-2xl font-bold text-foreground">{info.name}</div>
            {info.badge_title && (
              <div className="mt-2 inline-block text-[11px] px-3 py-1 rounded-full bg-accent/15 text-accent font-semibold border border-accent/30">
                🏅 {info.badge_title}
              </div>
            )}
          </div>
          {info.bonus_points > 0 && (
            <div className="bg-primary/10 rounded-xl px-4 py-3 text-sm font-semibold text-primary">
              +{info.bonus_points} pts de bônus creditados
            </div>
          )}
          <Button className="w-full" onClick={onClose}>Continuar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
