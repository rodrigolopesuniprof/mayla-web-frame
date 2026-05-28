import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DICEBEAR_STYLES,
  DICEBEAR_STYLE_LABELS,
  dicebearDataUri,
  type DicebearStyle,
} from "@/lib/avatar";
import { RefreshCw } from "lucide-react";

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

  const initialStyle: DicebearStyle =
    (DICEBEAR_STYLES as readonly string[]).includes(currentAvatarStyle ?? "")
      ? (currentAvatarStyle as DicebearStyle)
      : "adventurer";

  const [style, setStyle] = useState<DicebearStyle>(initialStyle);
  const [seed, setSeed] = useState<string>(currentAvatarSeed || userId);

  const isCustom = currentAvatarType === "dicebear";
  const label = isCustom ? "✏️ Alterar avatar" : "✏️ Personalizar avatar";

  const previewUri = useMemo(() => dicebearDataUri(style, seed || userId), [style, seed, userId]);

  const randomizeSeed = () => {
    setSeed(Math.random().toString(36).slice(2, 12));
  };

  const handleSave = async () => {
    setSaving(true);
    const finalSeed = seed || userId;
    const dataUri = dicebearDataUri(style, finalSeed);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: dataUri,
        avatar_type: "dicebear",
        avatar_style: style,
        avatar_seed: finalSeed,
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

    onUpdated(dataUri, "dicebear", style, finalSeed);
    setSaving(false);
    setOpen(false);
  };

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
            <Button type="button" variant="ghost" size="sm" onClick={randomizeSeed} className="gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Aleatório
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Estilo</Label>
              <div className="grid grid-cols-3 gap-2">
                {DICEBEAR_STYLES.map((s) => {
                  const active = s === style;
                  const thumb = dicebearDataUri(s, seed || userId);
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

            <div className="space-y-1.5">
              <Label htmlFor="avatar-seed" className="text-xs">Semente (personalizar)</Label>
              <Input
                id="avatar-seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="ex.: meu-nome"
              />
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
