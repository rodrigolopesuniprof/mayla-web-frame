import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { QrScanner } from "./QrScanner";
import { toast } from "@/hooks/use-toast";

export function EsfLinkScreen({ onBack, onLinked }: { onBack: () => void; onLinked: () => void }) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [esfName, setEsfName] = useState("");

  const handleScan = async (qrCode: string) => {
    if (!user || linking) return;
    setScanning(false);
    setLinking(true);

    try {
      // Look up ESF by qr_code
      const { data: esf, error } = await supabase
        .from("esf_teams")
        .select("id, name")
        .eq("qr_code", qrCode)
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;
      if (!esf) {
        toast({ title: "QR Code não reconhecido", description: "Este código não pertence a nenhuma ESF cadastrada.", variant: "destructive" });
        setLinking(false);
        return;
      }

      // Update profile with esf_team_id (trigger awards 500 pts)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ esf_team_id: esf.id } as any)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setEsfName(esf.name);
      setLinked(true);
      toast({ title: "Vinculado com sucesso! 🎉", description: `Você ganhou 500 pontos!` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLinking(false);
  };

  if (scanning) {
    return (
      <QrScanner
        onScan={handleScan}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-[22px] py-[14px] flex items-center gap-3 border-b border-border">
        <button onClick={onBack} className="text-sm text-primary bg-transparent border-none cursor-pointer">
          ← Voltar
        </button>
        <span className="font-display text-base font-medium text-foreground">Vincular ESF</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        {linked ? (
          <>
            <div className="text-6xl">🎉</div>
            <div>
              <h2 className="font-display text-xl font-medium text-foreground mb-2">Vinculado!</h2>
              <p className="text-sm text-muted-foreground mb-1">Você foi vinculado à</p>
              <p className="text-base font-semibold text-foreground">{esfName}</p>
              <p className="text-sm text-primary font-semibold mt-3">+500 pontos ganhos! ⭐</p>
            </div>
            <button
              onClick={onLinked}
              className="px-6 py-3 rounded-2xl text-sm font-semibold border-none cursor-pointer text-primary-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
            >
              Continuar
            </button>
          </>
        ) : (
          <>
            <div className="text-6xl">🏥</div>
            <div>
              <h2 className="font-display text-xl font-medium text-foreground mb-2">Vincule-se à sua ESF</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Escaneie o QR Code disponível na sua Equipe de Saúde da Família para se vincular e ganhar <strong className="text-primary">500 pontos</strong>.
              </p>
            </div>
            <button
              onClick={() => setScanning(true)}
              disabled={linking}
              className="px-6 py-3 rounded-2xl text-sm font-semibold border-none cursor-pointer text-primary-foreground"
              style={{ background: "linear-gradient(135deg, hsl(var(--mayla-pref)), hsl(var(--mayla-pref-lt)))" }}
            >
              {linking ? "Vinculando..." : "📷 Escanear QR Code"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
