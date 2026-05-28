import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  DICEBEAR_STYLES,
  DICEBEAR_STYLE_LABELS,
  AVATAR_PRESET_SEEDS,
  dicebearDataUri,
  findPresetIndex,
  nextPresetSeed,
  type DicebearStyle,
} from "@/lib/avatar";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  userId: string;
  currentAvatarType: string | null | undefined;
  currentAvatarStyle?: string | null;
  currentAvatarSeed?: string | null;
  pointsAwarded: boolean;
  onUpdated: (avatarUrl: string, avatarType: "dicebear", style: DicebearStyle, seed: string) => void;
}

export function AvatarCustomizerButton({
  userId,
  currentAvatarType,
  currentAvatarStyle,
  currentAvatarSeed,
  pointsAwarded,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const initialStyle: DicebearStyle =
    (DICEBEAR_STYLES as readonly string[]).includes(currentAvatarStyle ?? "")
      ? (currentAvatarStyle as DicebearStyle)
      : "adventurer";

  const initialIndex = (() => {
    const idx = findPresetIndex(currentAvatarSeed);
    return idx >= 0 ? idx : 0;
  })();

  const [style, setStyle] = useState<DicebearStyle>(initialStyle);
  const [presetIndex, setPresetIndex] = useState<number>(initialIndex);

  const seed = AVATAR_PRESET_SEEDS[presetIndex];

  const isCustom = currentAvatarType === "dicebear";
  const label = isCustom ? "✏️ Alterar avatar" : "✏️ Personalizar avatar";

  const previewUri = useMemo(() => dicebearDataUri(style, seed), [style, seed]);

  const go = (direction: 1 | -1) => {
    const { index } = nextPresetSeed(presetIndex, direction);
    setPresetIndex(index);
  };

  const handleSave = async () => {
    setSaving(true);
    const dataUri = dicebearDataUri(style, seed);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: dataUri,
        avatar_type: "dicebear",
        avatar_style: style,
        avatar_seed: seed,
      } as any)
      .eq("user_id", userId);

    if (error) {
      setSaving(false);
      toast({ title: "Erro ao salvar avatar", description: error.message, variant: "destructive" });
      return;
    }

    if (!pointsAwarded) {
      await supabase.rpc("add_points_to_profile" as any, { _user_id: userId, _points: 150 });
      await supabase
        .from("profiles")
        .update({ avatar_points_awarded: true } as any)
        .eq("user_id", userId);
      toast({ title: "Avatar personalizado! 🎉", description: "+150 pts" });
    } else {
      toast({ title: "Avatar atualizado! ✓" });
    }

    onUpdated(dataUri, "dicebear", style, seed);
    queryClient.invalidateQueries({ queryKey: ["my-avatar"] });
    setSaving(false);
    setOpen(false);
  };

  const total = AVATAR_PRESET_SEEDS.length;

  return (
    <>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <DialogTitle className="font-display text-base text-foreground">Personalize seu avatar</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-muted ring-2 ring-border">
              <img src={previewUri} alt="Pré-visualização" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => go(-1)}
                aria-label="Variação anterior"
                className="h-9 w-9"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[3.5rem] text-center">
                {presetIndex + 1} / {total}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => go(1)}
                aria-label="Próxima variação"
                className="h-9 w-9"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs text-foreground font-medium">Estilo</div>
            <div className="grid grid-cols-3 gap-2">
              {DICEBEAR_STYLES.map((s) => {
                const active = s === style;
                const thumb = dicebearDataUri(s, seed);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={
                      "flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors " +
                      (active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted")
                    }
                  >
                    <img src={thumb} alt={s} className="w-12 h-12 rounded-full bg-muted" />
                    <span className="text-[10px] text-foreground leading-tight text-center">
                      {DICEBEAR_STYLE_LABELS[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar avatar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
