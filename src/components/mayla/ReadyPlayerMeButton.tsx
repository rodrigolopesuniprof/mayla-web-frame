import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  currentAvatarType: string | null | undefined;
  pointsAwarded: boolean;
  onUpdated: (avatarUrl: string, avatarType: "readyplayerme") => void;
}

const RPM_PREFIX = "https://models.readyplayer.me/";

export function ReadyPlayerMeButton({ userId, currentAvatarType, pointsAwarded, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const handlerRef = useRef<((ev: MessageEvent) => void) | null>(null);

  const isRpm = currentAvatarType === "readyplayerme";
  const label = isRpm ? "✏️ Alterar avatar" : "✏️ Personalizar avatar";

  useEffect(() => {
    if (!open) {
      if (handlerRef.current) {
        window.removeEventListener("message", handlerRef.current);
        handlerRef.current = null;
      }
      return;
    }

    const handler = async (ev: MessageEvent) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      if (!raw.startsWith(RPM_PREFIX) || !raw.endsWith(".glb")) return;

      const pngUrl = raw.replace(".glb", ".png") + "?scene=fullbody-portrait-v1";
      setOpen(false);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: pngUrl, avatar_type: "readyplayerme" } as any)
        .eq("user_id", userId);

      if (error) {
        toast({ title: "Erro ao salvar avatar", description: error.message, variant: "destructive" });
        return;
      }

      if (!pointsAwarded) {
        await supabase.rpc("add_points_to_profile" as any, {
          _user_id: userId,
          _points: 150,
        });
        await supabase
          .from("profiles")
          .update({ avatar_points_awarded: true } as any)
          .eq("user_id", userId);
        toast({ title: "Avatar personalizado! 🎉", description: "+150 pts" });
      } else {
        toast({ title: "Avatar atualizado! ✓" });
      }

      onUpdated(pngUrl, "readyplayerme");
    };

    handlerRef.current = handler;
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      handlerRef.current = null;
    };
  }, [open, userId, pointsAwarded, onUpdated]);

  return (
    <>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] h-[85vh] p-4 flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="font-display text-base text-foreground">Crie seu avatar</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <iframe
              title="Ready Player Me"
              src="https://demo.readyplayer.me/avatar?frameApi&lang=pt"
              allow="camera *; microphone *; clipboard-write"
              className="w-full h-full rounded-lg border-0 bg-muted"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
