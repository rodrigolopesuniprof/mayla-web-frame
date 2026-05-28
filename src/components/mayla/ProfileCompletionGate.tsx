import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

/**
 * Modal bloqueante exibido quando o usuário ainda não preencheu
 * `birth_date` ou `biological_sex` no perfil. Ambos são obrigatórios
 * para a integração com agendamento externo (Meddit).
 */
export function ProfileCompletionGate({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsCompletion, setNeedsCompletion] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, biological_sex")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const missing = !data?.birth_date || !data?.biological_sex;
      setNeedsCompletion(missing);
      setLoading(false);
      if (!missing) onComplete();
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!birthDate || !sex) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    // Sanity check: idade entre 0 e 120
    const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (isNaN(age) || age < 0 || age > 120) {
      toast({ title: "Data de nascimento inválida", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ birth_date: birthDate, biological_sex: sex, gender_other_text: sex === "other" ? otherText : null } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    // Award one-time bonus for completing profile (caps to lifetime=1)
    await supabase.rpc("award_event" as any, {
      _user_id: user.id,
      _event_key: "profile_complete",
      _description: "Cadastro completo",
    } as any);
    toast({ title: "Dados salvos!" });
    setNeedsCompletion(false);
    onComplete();
  };

  if (loading || !needsCompletion) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-xl">
        <div className="text-center mb-5">
          <span className="text-3xl block mb-2">📋</span>
          <h2 className="font-display text-lg font-semibold text-foreground">Complete seu cadastro</h2>
          <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
            Precisamos desses dados para liberar o agendamento de consultas.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-foreground block mb-1.5">
              Data de nascimento
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full h-11 px-3 bg-secondary border border-border rounded-xl text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-foreground block mb-1.5">
              Gênero
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "male", l: "Masculino" },
                { v: "female", l: "Feminino" },
                { v: "non_binary", l: "Não-binário" },
                { v: "agender", l: "Agênero" },
                { v: "other", l: "Outro" },
                { v: "prefer_not_say", l: "Prefiro não informar" },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSex(v)}
                  className={`h-11 rounded-xl text-[12px] font-medium border transition-colors ${
                    sex === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {sex === "other" && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Especifique..."
                className="w-full h-11 px-3 mt-2 bg-secondary border border-border rounded-xl text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                maxLength={50}
              />
            )}
          </div>


          <button
            onClick={handleSave}
            disabled={saving || !birthDate || !sex}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50 mt-2"
          >
            {saving ? "Salvando..." : "Salvar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
