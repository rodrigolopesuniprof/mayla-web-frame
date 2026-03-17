import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Mode = "login" | "forgot";

export default function ProfessionalLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      return;
    }

    // Check if user has a linked partner
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast({ title: "Erro de autenticação", variant: "destructive" });
      return;
    }

    const { data: partner } = await supabase
      .from("partners")
      .select("id, active, approval_status")
      .eq("user_id", user.id)
      .maybeSingle();

    setLoading(false);

    if (!partner) {
      toast({
        title: "Conta não vinculada",
        description: "Seu e-mail não está vinculado a nenhum profissional. Solicite ao administrador que vincule sua conta.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    if (!partner.active || partner.approval_status !== "approved") {
      toast({
        title: "Cadastro pendente",
        description: "Seu cadastro profissional ainda não foi aprovado. Entre em contato com o administrador.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    navigate("/painel-profissional");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
      setMode("login");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-[400px] mx-auto px-6 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-4">
            🩺
          </div>
          <div className="font-display text-[32px] font-bold text-foreground tracking-tight leading-none">
            mayla<span className="text-accent">.</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 tracking-[.14em] uppercase mb-4">
            portal profissional
          </div>
          <h1 className="font-display text-xl font-medium text-foreground">
            {mode === "login" ? "Acesso Profissional" : "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {mode === "login"
              ? "Entre com o e-mail vinculado ao seu cadastro de profissional"
              : "Enviaremos um link para redefinir sua senha"
            }
          </p>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleForgot} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail profissional</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>

          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Enviar link"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-6 text-sm">
          {mode === "login" ? (
            <>
              <button onClick={() => setMode("forgot")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
                Esqueceu a senha?
              </button>
              <div className="text-xs text-muted-foreground text-center mt-4 bg-secondary rounded-xl p-3">
                <p className="font-medium text-foreground mb-1">Ainda não tem acesso?</p>
                <p>O administrador precisa vincular seu e-mail ao cadastro profissional no painel admin.</p>
              </div>
            </>
          ) : (
            <button onClick={() => setMode("login")} className="text-primary hover:underline bg-transparent border-none cursor-pointer">
              ← Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
